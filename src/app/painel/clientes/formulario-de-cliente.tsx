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

import { formatarCep, formatarTelefone } from '@/lib/formatos'
import { formatarDocumento, normalizarDocumento, tipoDoDocumento } from '@/lib/documento'
import { conferirDocumento, type EstadoDoCliente } from './acoes'

export type ValoresDoCliente = {
  documento: string
  nome: string
  rg: string
  dataNascimento: string
  estadoCivil: string
  profissao: string
  nacionalidade: string
  email: string
  telefone: string
  cep: string
  endereco: string
}

export const VALORES_VAZIOS: ValoresDoCliente = {
  documento: '',
  nome: '',
  rg: '',
  dataNascimento: '',
  estadoCivil: '',
  profissao: '',
  nacionalidade: '',
  email: '',
  telefone: '',
  cep: '',
  endereco: '',
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
}: {
  nome: string
  rotulo: string
  children: React.ReactNode
  erro?: string
  dica?: React.ReactNode
  complemento?: React.ReactNode
}) {
  return (
    <div className="mb-[15px]">
      <label className="campo-rotulo" htmlFor={nome}>
        {rotulo}
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
  const erros = estado?.erros ?? {}
  const idDoFormulario = useId()

  const [documento, setDocumento] = useState(valores.documento)
  const [telefone, setTelefone] = useState(valores.telefone)
  const [cep, setCep] = useState(valores.cep)
  const [reconhecimento, setReconhecimento] = useState<Reconhecimento>({
    estado: 'vazio',
  })
  const [, iniciarConsulta] = useTransition()
  /** Número da última consulta disparada, para descartar resposta atrasada. */
  const ultimaConsulta = useRef(0)

  useEffect(() => {
    if (!reconhecerAoDigitar) return

    const digitos = normalizarDocumento(documento)
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
  }, [documento, reconhecerAoDigitar])

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

      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <div className="cartao">
          <div className="cartao-cabecalho">
            <h2>Identificação</h2>
          </div>

          <div className="cartao-corpo">
            <Campo
              nome="documento"
              rotulo="CPF ou CNPJ"
              erro={erros['documento']}
              dica={dicaDoDocumento}
            >
              <input
                id="documento"
                name="documento"
                inputMode="numeric"
                autoComplete="off"
                required
                className="campo-entrada mono"
                placeholder="000.000.000-00"
                value={documento}
                onChange={(evento) => setDocumento(evento.target.value)}
                onBlur={() =>
                  setDocumento((atual) => {
                    // Formatar um documento incompleto apagaria o que a pessoa
                    // acabou de digitar. Só formata quando está inteiro.
                    const digitos = normalizarDocumento(atual)
                    return digitos.length === 11 || digitos.length === 14
                      ? formatarDocumento(atual)
                      : atual
                  })
                }
              />
            </Campo>

            <Campo nome="nome" rotulo="Nome completo" erro={erros['nome']}>
              <input
                id="nome"
                name="nome"
                required
                className="campo-entrada"
                defaultValue={valores.nome}
              />
            </Campo>

            <div className="flex flex-col gap-0 sm:flex-row sm:gap-3.5">
              <div className="flex-1">
                <Campo nome="rg" rotulo="RG ou inscrição estadual" erro={erros['rg']}>
                  <input
                    id="rg"
                    name="rg"
                    className="campo-entrada"
                    defaultValue={valores.rg}
                  />
                </Campo>
              </div>
              <div className="flex-1">
                <Campo
                  nome="dataNascimento"
                  rotulo="Data de nascimento ou de fundação"
                  erro={erros['dataNascimento']}
                >
                  <input
                    id="dataNascimento"
                    name="dataNascimento"
                    type="date"
                    className="campo-entrada mono"
                    defaultValue={valores.dataNascimento}
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
                >
                  <input
                    id="estadoCivil"
                    name="estadoCivil"
                    className="campo-entrada"
                    defaultValue={valores.estadoCivil}
                  />
                </Campo>
              </div>
              <div className="flex-1">
                <Campo nome="profissao" rotulo="Profissão" erro={erros['profissao']}>
                  <input
                    id="profissao"
                    name="profissao"
                    className="campo-entrada"
                    defaultValue={valores.profissao}
                  />
                </Campo>
              </div>
            </div>

            <Campo
              nome="nacionalidade"
              rotulo="Nacionalidade"
              erro={erros['nacionalidade']}
            >
              <input
                id="nacionalidade"
                name="nacionalidade"
                className="campo-entrada"
                defaultValue={valores.nacionalidade}
              />
            </Campo>

            <div className="my-[18px] border-t border-borda" />

            <Campo
              nome="email"
              rotulo="E-mail"
              erro={erros['email']}
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
                defaultValue={valores.email}
              />
            </Campo>

            <div className="flex flex-col gap-0 sm:flex-row sm:gap-3.5">
              <div className="flex-1">
                <Campo nome="telefone" rotulo="Telefone" erro={erros['telefone']}>
                  <input
                    id="telefone"
                    name="telefone"
                    inputMode="tel"
                    className="campo-entrada mono"
                    placeholder="(11) 90000-0000"
                    value={telefone}
                    onChange={(evento) => setTelefone(evento.target.value)}
                    onBlur={() => setTelefone((atual) => formatarTelefone(atual))}
                  />
                </Campo>
              </div>
              <div className="flex-1">
                <Campo nome="cep" rotulo="CEP" erro={erros['cep']}>
                  <input
                    id="cep"
                    name="cep"
                    inputMode="numeric"
                    className="campo-entrada mono"
                    placeholder="00000-000"
                    value={cep}
                    onChange={(evento) => setCep(evento.target.value)}
                    onBlur={() => setCep((atual) => formatarCep(atual))}
                  />
                </Campo>
              </div>
            </div>

            <Campo nome="endereco" rotulo="Endereço" erro={erros['endereco']}>
              <input
                id="endereco"
                name="endereco"
                className="campo-entrada"
                defaultValue={valores.endereco}
              />
            </Campo>

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
