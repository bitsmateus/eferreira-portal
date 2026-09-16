'use client'

import Link from 'next/link'
import {
  useActionState,
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
} from 'react'
import { useFormStatus } from 'react-dom'
import { TipoPessoa } from '@prisma/client'

import { ehObrigatorio } from '@/lib/campos-do-cliente'
import {
  UNIDADES_FEDERATIVAS,
  formatarCep,
  formatarTelefone,
} from '@/lib/formatos'
import { formatarDocumento, normalizarDocumento, tipoDoDocumento } from '@/lib/documento'
import { enderecoParaOCampo } from '@/lib/cep'
import { conferirDocumento, consultarCep, type EstadoDoCliente } from './acoes'

export type ValoresDoCliente = {
  documento: string
  nome: string
  rg: string
  dataNascimento: string
  estadoCivil: string
  profissao: string
  nacionalidade: string
  nomeMae: string
  email: string
  telefone: string
  cep: string
  endereco: string
  cidade: string
  uf: string
}

export const VALORES_VAZIOS: ValoresDoCliente = {
  documento: '',
  nome: '',
  rg: '',
  dataNascimento: '',
  estadoCivil: '',
  profissao: '',
  nacionalidade: '',
  nomeMae: '',
  email: '',
  telefone: '',
  cep: '',
  endereco: '',
  cidade: '',
  uf: '',
}

type Props = {
  acao: (estado: EstadoDoCliente, dados: FormData) => Promise<EstadoDoCliente>
  valores: ValoresDoCliente
  rotuloDoBotao: string
  hrefCancelar: string
  /** Na edição não faz sentido oferecer "abrir o cadastro existente". */
  reconhecerAoDigitar: boolean
}

function Campo({
  nome,
  rotulo,
  children,
  erro,
  dica,
  complemento,
  obrigatorio = false,
}: {
  nome: string
  rotulo: string
  children: React.ReactNode
  erro?: string
  dica?: React.ReactNode
  complemento?: React.ReactNode
  obrigatorio?: boolean
}) {
  return (
    <div className="mb-[15px]">
      <label className="campo-rotulo" htmlFor={nome}>
        {rotulo}
        {obrigatorio && (
          <>
            {/* O asterisco é decoração para quem enxerga; quem usa leitor de
                tela ouve a palavra, que é o que realmente informa. */}
            <span aria-hidden="true" className="text-erro">
              {' *'}
            </span>
            <span className="sr-only"> (obrigatório)</span>
          </>
        )}
        {complemento}
      </label>
      {children}
      {erro !== undefined ? (
        <p className="dica dica-erro" role="alert">
          {erro}
        </p>
      ) : (
        dica
      )}
    </div>
  )
}

function BotaoSalvar({ rotulo }: { rotulo: string }) {
  const { pending } = useFormStatus()
  return (
    <button type="submit" className="botao" disabled={pending}>
      {pending ? 'Salvando…' : rotulo}
    </button>
  )
}

/** A busca de endereço enquanto se digita o CEP. */
type BuscaDoCep =
  | { estado: 'parado' }
  | { estado: 'procurando' }
  | { estado: 'nao_achou' }
  | {
      estado: 'achou'
      endereco: { logradouro: string; bairro: string; cidade: string; uf: string }
      /** Quais campos esta busca preencheu — os que estavam vazios. */
      preenchidos: string[]
    }

/** O reconhecimento do passo 2, enquanto se digita o CPF ou CNPJ. */
type Reconhecimento =
  | { estado: 'vazio' }
  | { estado: 'invalido' }
  | { estado: 'consultando' }
  | { estado: 'livre'; tipo: 'CPF' | 'CNPJ' }
  | { estado: 'existente'; id: string; nome: string; quantidadeDeCasos: number }

export function FormularioDeCliente({
  acao,
  valores,
  rotuloDoBotao,
  hrefCancelar,
  reconhecerAoDigitar,
}: Props) {
  const [estado, enviar] = useActionState(acao, undefined)
  const errosDoServidor = estado?.erros ?? {}
  const idDoFormulario = useId()

  /**
   * O ERRO SOME ASSIM QUE A PESSOA COMEÇA A CORRIGIR O CAMPO.
   *
   * Sem isto, o recado da última tentativa fica colado no campo até alguém
   * salvar de novo — e, no CPF, ele ocupava o lugar da dica ao vivo: a pessoa
   * digitava um CPF válido, o sistema já sabia que estava certo, e a tela
   * continuava dizendo "Informe o CPF ou o CNPJ". Errado e desanimador.
   */
  const [corrigidos, setCorrigidos] = useState<ReadonlySet<string>>(new Set())

  useEffect(() => {
    // Resposta nova do servidor: os recados valem outra vez.
    setCorrigidos(new Set())
  }, [estado])

  const erros: Record<string, string | undefined> = Object.fromEntries(
    Object.entries(errosDoServidor).filter(([campo]) => !corrigidos.has(campo)),
  )

  /**
   * TODO CAMPO É CONTROLADO, E ISSO NÃO É ESTILO — É O CONSERTO DE UM DEFEITO.
   *
   * Antes, só documento, telefone e CEP tinham estado; o resto era
   * `defaultValue`. Quando a gravação era recusada por falta de um campo
   * obrigatório, o React reiniciava o formulário ao fim da ação e **tudo o
   * que tinha sido digitado desaparecia** — o operador preenchia a ficha
   * inteira, errava um campo e recomeçava do zero.
   *
   * Com o valor no estado do componente, a recusa não apaga nada: a tela
   * volta com tudo no lugar e o erro apontando o que falta preencher.
   */
  const [campos, setCampos] = useState<ValoresDoCliente>(valores)

  const [reconhecimento, setReconhecimento] = useState<Reconhecimento>({
    estado: 'vazio',
  })
  const [buscaDoCep, setBuscaDoCep] = useState<BuscaDoCep>({ estado: 'parado' })
  const ultimoCep = useRef('')
  const [, iniciarConsulta] = useTransition()
  /** Número da última consulta disparada, para descartar resposta atrasada. */
  const ultimaConsulta = useRef(0)

  function definir<C extends keyof ValoresDoCliente>(nome: C, valor: string): void {
    setCampos((atual) => ({ ...atual, [nome]: valor }))
    setCorrigidos((atual) => (atual.has(nome) ? atual : new Set(atual).add(nome)))
  }

  // Só para a tela saber o que mostrar. Quem decide o tipo de pessoa de
  // verdade é o servidor, a partir do próprio documento (regra 2).
  const ehPessoaJuridica = normalizarDocumento(campos.documento).length === 14

  /**
   * Enquanto o documento não estiver completo, a tela assume pessoa física —
   * que é a lista mais exigente. Assim que um CNPJ é digitado, os asteriscos
   * da qualificação pessoal somem sozinhos: aqueles dados são do sócio, não
   * da empresa.
   */
  const tipoPessoa = ehPessoaJuridica ? TipoPessoa.JURIDICA : TipoPessoa.FISICA
  const obrigatorio = (campo: keyof ValoresDoCliente) =>
    ehObrigatorio(campo, tipoPessoa)

  useEffect(() => {
    if (!reconhecerAoDigitar) return

    const digitos = normalizarDocumento(campos.documento)
    if (digitos === '') {
      setReconhecimento({ estado: 'vazio' })
      return
    }

    const tipo = tipoDoDocumento(digitos)
    if (tipo === null) {
      setReconhecimento({ estado: 'invalido' })
      return
    }

    setReconhecimento({ estado: 'consultando' })

    // Cancelar o relógio não cancela a consulta já enviada. Sem esta marca, a
    // resposta atrasada do CPF anterior chegaria depois e rotularia o CPF
    // atual como "já cadastrado" com o nome errado.
    const requisicao = ++ultimaConsulta.current

    // Espera a digitação parar: sem isso, cada tecla vira uma consulta.
    const relogio = setTimeout(() => {
      iniciarConsulta(async () => {
        const achado = await conferirDocumento(digitos)

        // Chegou tarde: já se está conferindo outro documento. Descarta.
        if (requisicao !== ultimaConsulta.current) return

        if (
          achado.encontrado &&
          achado.id !== undefined &&
          achado.nome !== undefined
        ) {
          setReconhecimento({
            estado: 'existente',
            id: achado.id,
            nome: achado.nome,
            quantidadeDeCasos: achado.quantidadeDeCasos ?? 0,
          })
        } else {
          setReconhecimento({ estado: 'livre', tipo })
        }
      })
    }, 400)

    return () => clearTimeout(relogio)
  }, [campos.documento, reconhecerAoDigitar])

  /**
   * A BUSCA PELO CEP NUNCA APAGA O QUE A PESSOA ESCREVEU.
   *
   * Só preenche campo vazio. É a regra que torna o comportamento previsível:
   * quem corrigiu um endereço à mão não vê a correção sumir porque mexeu no
   * CEP depois, e quem está cadastrando do zero tem tudo preenchido.
   *
   * O número e o complemento ficam por conta de quem cadastra — o CEP não os
   * conhece —, e o bairro aparece na dica para ser acrescentado, em vez de
   * entrar no meio do texto e parecer pronto sem o número.
   */
  useEffect(() => {
    const digitos = normalizarDocumento(campos.cep)

    if (digitos.length !== 8) {
      setBuscaDoCep({ estado: 'parado' })
      return
    }

    // O mesmo CEP não é consultado duas vezes: formatar no blur muda o texto
    // do campo sem mudar o CEP.
    if (digitos === ultimoCep.current) return

    setBuscaDoCep({ estado: 'procurando' })

    const relogio = setTimeout(() => {
      iniciarConsulta(async () => {
        const achado = await consultarCep(digitos)
        ultimoCep.current = digitos

        if (achado === null) {
          setBuscaDoCep({ estado: 'nao_achou' })
          return
        }

        const preenchidos: string[] = []
        setCampos((atual) => {
          const novo = { ...atual }
          const sugestaoDeEndereco = enderecoParaOCampo(achado)

          if (atual.endereco.trim() === '' && sugestaoDeEndereco !== '') {
            novo.endereco = sugestaoDeEndereco
            preenchidos.push('endereço')
          }
          if (atual.cidade.trim() === '') {
            novo.cidade = achado.cidade
            preenchidos.push('cidade')
          }
          if (atual.uf.trim() === '') {
            novo.uf = achado.uf
            preenchidos.push('UF')
          }
          return novo
        })

        setBuscaDoCep({ estado: 'achou', endereco: achado, preenchidos })
      })
    }, 500)

    return () => clearTimeout(relogio)
  }, [campos.cep])

  const dicaDoCep = (() => {
    if (buscaDoCep.estado === 'procurando') {
      return <p className="dica">Procurando o endereço…</p>
    }
    if (buscaDoCep.estado === 'nao_achou') {
      return (
        <p className="dica">
          Não encontrei este CEP. Preencha o endereço à mão — o cadastro não
          depende desta busca.
        </p>
      )
    }
    if (buscaDoCep.estado === 'achou') {
      const { endereco, preenchidos } = buscaDoCep
      return (
        <p className="dica dica-ok">
          {preenchidos.length === 0
            ? 'CEP encontrado. Não mexi em nada: os campos já estavam preenchidos.'
            : `Preenchi ${preenchidos.join(', ')}.`}
          {endereco.bairro !== '' && (
            <>
              {' '}
              Bairro: <b className="text-texto">{endereco.bairro}</b> — acrescente
              depois do número.
            </>
          )}
        </p>
      )
    }
    return undefined
  })()

  const dicaDoDocumento = (() => {
    if (reconhecimento.estado === 'consultando') {
      return <p className="dica">Conferindo…</p>
    }
    if (reconhecimento.estado === 'invalido') {
      return (
        <p className="dica dica-erro">
          Dígito verificador não confere. Confira o número digitado.
        </p>
      )
    }
    if (reconhecimento.estado === 'livre') {
      return (
        <p className="dica dica-ok">
          ✓ {reconhecimento.tipo} válido · nenhum cadastro anterior encontrado
        </p>
      )
    }
    if (reconhecimento.estado === 'existente') {
      return (
        <p className="dica">
          Já cadastrado como <b className="text-texto">{reconhecimento.nome}</b> ·{' '}
          {reconhecimento.quantidadeDeCasos === 1
            ? '1 caso'
            : `${reconhecimento.quantidadeDeCasos} casos`}{' '}
          ·{' '}
          <Link
            href={`/painel/clientes/${reconhecimento.id}`}
            className="text-info underline underline-offset-2"
          >
            abrir a ficha existente
          </Link>
        </p>
      )
    }
    return undefined
  })()

  /** Quantos campos a última tentativa recusou e ainda não foram tocados. */
  const quantosErros = Object.keys(erros).length

  return (
    <form action={enviar} noValidate id={idDoFormulario}>
      {estado?.mensagem !== undefined && (
        <div className="aviso aviso-atencao mb-4" role="alert">
          <span aria-hidden="true">▲</span>
          <div>
            {estado.mensagem}
            {estado.duplicado !== undefined && (
              <>
                {' '}
                <Link
                  href={`/painel/clientes/${estado.duplicado.id}`}
                  className="underline underline-offset-2"
                >
                  Abrir a ficha de {estado.duplicado.nome}
                </Link>
                .
              </>
            )}
          </div>
        </div>
      )}

      {quantosErros > 0 && (
        <div className="aviso aviso-atencao mb-4" role="alert">
          <span aria-hidden="true">▲</span>
          <div>
            <b>
              {quantosErros === 1
                ? 'Falta preencher 1 campo.'
                : `Faltam preencher ${quantosErros} campos.`}
            </b>{' '}
            Nada do que você digitou foi perdido — complete o que está marcado
            em vermelho e salve de novo.
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <div className="cartao">
          <div className="cartao-cabecalho">
            <h2>Identificação</h2>
            <span className="ml-auto text-[11.5px] text-texto-3">
              <span aria-hidden="true" className="text-erro">
                *
              </span>{' '}
              obrigatório
            </span>
          </div>

          <div className="cartao-corpo">
            <Campo
              nome="documento"
              rotulo="CPF ou CNPJ"
              erro={erros['documento']}
              dica={dicaDoDocumento}
              obrigatorio={obrigatorio('documento')}
            >
              <input
                id="documento"
                name="documento"
                inputMode="numeric"
                autoComplete="off"
                required
                className="campo-entrada mono"
                placeholder="000.000.000-00"
                value={campos.documento}
                onChange={(evento) => definir('documento', evento.target.value)}
                onBlur={() =>
                  setCampos((atual) => {
                    // Formatar um documento incompleto apagaria o que a pessoa
                    // acabou de digitar. Só formata quando está inteiro.
                    const digitos = normalizarDocumento(atual.documento)
                    return digitos.length === 11 || digitos.length === 14
                      ? { ...atual, documento: formatarDocumento(atual.documento) }
                      : atual
                  })
                }
              />
            </Campo>

            <Campo
              nome="nome"
              rotulo="Nome completo"
              erro={erros['nome']}
              obrigatorio={obrigatorio('nome')}
            >
              <input
                id="nome"
                name="nome"
                required
                className="campo-entrada"
                value={campos.nome}
                onChange={(evento) => definir('nome', evento.target.value)}
              />
            </Campo>

            <div className="flex flex-col gap-0 sm:flex-row sm:gap-3.5">
              <div className="flex-1">
                <Campo
                  nome="rg"
                  rotulo="RG ou inscrição estadual"
                  erro={erros['rg']}
                  obrigatorio={obrigatorio('rg')}
                >
                  <input
                    id="rg"
                    name="rg"
                    className="campo-entrada"
                    value={campos.rg}
                    onChange={(evento) => definir('rg', evento.target.value)}
                  />
                </Campo>
              </div>
              <div className="flex-1">
                <Campo
                  nome="dataNascimento"
                  rotulo="Data de nascimento ou de fundação"
                  erro={erros['dataNascimento']}
                  obrigatorio={obrigatorio('dataNascimento')}
                >
                  <input
                    id="dataNascimento"
                    name="dataNascimento"
                    type="date"
                    className="campo-entrada mono"
                    value={campos.dataNascimento}
                    onChange={(evento) =>
                      definir('dataNascimento', evento.target.value)
                    }
                  />
                </Campo>
              </div>
            </div>

            <div className="flex flex-col gap-0 sm:flex-row sm:gap-3.5">
              <div className="flex-1">
                <Campo
                  nome="estadoCivil"
                  rotulo="Estado civil"
                  erro={erros['estadoCivil']}
                  obrigatorio={obrigatorio('estadoCivil')}
                >
                  <input
                    id="estadoCivil"
                    name="estadoCivil"
                    className="campo-entrada"
                    value={campos.estadoCivil}
                    onChange={(evento) => definir('estadoCivil', evento.target.value)}
                  />
                </Campo>
              </div>
              <div className="flex-1">
                <Campo
                  nome="profissao"
                  rotulo="Profissão"
                  erro={erros['profissao']}
                  obrigatorio={obrigatorio('profissao')}
                >
                  <input
                    id="profissao"
                    name="profissao"
                    className="campo-entrada"
                    value={campos.profissao}
                    onChange={(evento) => definir('profissao', evento.target.value)}
                  />
                </Campo>
              </div>
            </div>

            <div className="flex flex-col gap-0 sm:flex-row sm:gap-3.5">
              <div className="flex-1">
                <Campo
                  nome="nacionalidade"
                  rotulo="Nacionalidade"
                  erro={erros['nacionalidade']}
                  obrigatorio={obrigatorio('nacionalidade')}
                >
                  <input
                    id="nacionalidade"
                    name="nacionalidade"
                    className="campo-entrada"
                    value={campos.nacionalidade}
                    onChange={(evento) => definir('nacionalidade', evento.target.value)}
                  />
                </Campo>
              </div>
              <div className="flex-1">
                <Campo
                  nome="nomeMae"
                  rotulo="Nome da mãe"
                  erro={erros['nomeMae']}
                  obrigatorio={obrigatorio('nomeMae')}
                  dica={
                    ehPessoaJuridica ? undefined : (
                      <p className="dica">
                        Exigido pela procuração, pela declaração e pelo contrato.
                      </p>
                    )
                  }
                >
                  <input
                    id="nomeMae"
                    name="nomeMae"
                    className="campo-entrada"
                    value={campos.nomeMae}
                    onChange={(evento) => definir('nomeMae', evento.target.value)}
                  />
                </Campo>
              </div>
            </div>

            {ehPessoaJuridica && (
              <div className="aviso aviso-info mb-[15px]">
                <span aria-hidden="true">▲</span>
                <div>
                  <b>Qualificação pessoal é do sócio, não da empresa.</b> RG, estado
                  civil, profissão, nacionalidade e nome da mãe ficam no cadastro do
                  representante legal — que é um cliente pessoa física ligado a esta
                  empresa. Você vincula o representante na ficha, depois de salvar.
                </div>
              </div>
            )}

            <div className="my-[18px] border-t border-borda" />

            <Campo
              nome="email"
              rotulo="E-mail"
              erro={erros['email']}
              obrigatorio={obrigatorio('email')}
              complemento={
                <span className="text-erro"> · necessário para o acesso do cliente</span>
              }
            >
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="off"
                className="campo-entrada"
                value={campos.email}
                onChange={(evento) => definir('email', evento.target.value)}
              />
            </Campo>

            <div className="flex flex-col gap-0 sm:flex-row sm:gap-3.5">
              <div className="flex-1">
                <Campo
                  nome="telefone"
                  rotulo="Telefone"
                  erro={erros['telefone']}
                  obrigatorio={obrigatorio('telefone')}
                >
                  <input
                    id="telefone"
                    name="telefone"
                    inputMode="tel"
                    className="campo-entrada mono"
                    placeholder="(11) 90000-0000"
                    value={campos.telefone}
                    onChange={(evento) => definir('telefone', evento.target.value)}
                    onBlur={() =>
                      setCampos((atual) => ({
                        ...atual,
                        telefone: formatarTelefone(atual.telefone),
                      }))
                    }
                  />
                </Campo>
              </div>
              <div className="flex-1">
                <Campo
                  nome="cep"
                  rotulo="CEP"
                  erro={erros['cep']}
                  dica={dicaDoCep}
                  obrigatorio={obrigatorio('cep')}
                >
                  <input
                    id="cep"
                    name="cep"
                    inputMode="numeric"
                    className="campo-entrada mono"
                    placeholder="00000-000"
                    value={campos.cep}
                    onChange={(evento) => definir('cep', evento.target.value)}
                    onBlur={() =>
                      setCampos((atual) => ({
                        ...atual,
                        cep: formatarCep(atual.cep),
                      }))
                    }
                  />
                </Campo>
              </div>
            </div>

            <Campo
              nome="endereco"
              rotulo="Endereço"
              erro={erros['endereco']}
              obrigatorio={obrigatorio('endereco')}
            >
              <input
                id="endereco"
                name="endereco"
                className="campo-entrada"
                placeholder="Rua, número, complemento e bairro"
                value={campos.endereco}
                onChange={(evento) => definir('endereco', evento.target.value)}
              />
              <p className="dica">Sem a cidade — ela vai nos campos abaixo.</p>
            </Campo>

            <div className="flex gap-3">
              <div className="flex-1">
                <Campo
                  nome="cidade"
                  rotulo="Cidade"
                  erro={erros['cidade']}
                  obrigatorio={obrigatorio('cidade')}
                >
                  <input
                    id="cidade"
                    name="cidade"
                    className="campo-entrada"
                    value={campos.cidade}
                    onChange={(evento) => definir('cidade', evento.target.value)}
                  />
                  <p className="dica">
                    É esta cidade que sai na assinatura dos documentos.
                  </p>
                </Campo>
              </div>
              <div className="w-[110px]">
                <Campo
                  nome="uf"
                  rotulo="UF"
                  erro={erros['uf']}
                  obrigatorio={obrigatorio('uf')}
                >
                  <select
                    id="uf"
                    name="uf"
                    className="campo-entrada"
                    value={campos.uf}
                    onChange={(evento) => definir('uf', evento.target.value)}
                  >
                    <option value="">—</option>
                    {UNIDADES_FEDERATIVAS.map((sigla) => (
                      <option key={sigla} value={sigla}>
                        {sigla}
                      </option>
                    ))}
                  </select>
                </Campo>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <BotaoSalvar rotulo={rotuloDoBotao} />
              <Link href={hrefCancelar} className="botao botao-secundario">
                Cancelar
              </Link>
            </div>
          </div>
        </div>

        <div>
          <div className="cartao mb-4">
            <div className="cartao-cabecalho">
              <h2>O que acontece ao salvar</h2>
            </div>
            <div className="cartao-corpo text-[12.5px] leading-relaxed text-texto-2">
              <p className="mb-3">
                <b className="text-texto">Cliente criado.</b> Passa a ser localizável
                pelo CPF ou CNPJ em todo o sistema.
              </p>
              <p className="mb-3">
                <b className="text-texto">Pasta do cliente aberta.</b> Vazia, pronta
                para receber contrato, procuração e declaração.
              </p>
              <p>
                <b className="text-texto">Acesso ainda bloqueado.</b> O cliente só entra
                depois que o contrato for assinado — Anexo I, 1.d.
              </p>
            </div>
          </div>

          <div className="aviso aviso-atencao">
            <span aria-hidden="true">▲</span>
            <div>
              <b>Validação de verdade.</b> O sistema confere o dígito verificador do
              CPF e do CNPJ, não só o formato. Cadastro com número inválido é o que
              quebra a busca seis meses depois.
            </div>
          </div>
        </div>
      </div>
    </form>
  )
}
