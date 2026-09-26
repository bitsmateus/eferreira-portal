'use client'

import { useActionState, useEffect, useRef, useState, useTransition } from 'react'
import { useFormStatus } from 'react-dom'

import { Etiqueta } from '@/componentes/etiqueta'
import { ESTADOS_CIVIS } from '@/lib/campos-do-cliente'
import type { LinhaDeAdvogado } from '@/lib/advogados'
import {
  cadastrarAdvogado,
  definirComoPadrao,
  desativarAdvogado,
  reativarAdvogado,
  salvarEdicaoDeAdvogado,
  type EstadoDoAdvogado,
} from './acoes'

type Valores = {
  nome: string
  genero: string
  nacionalidade: string
  estadoCivil: string
  oab: string
  oabUf: string
}

const VAZIO: Valores = {
  nome: '',
  genero: 'M',
  nacionalidade: 'brasileiro',
  estadoCivil: '',
  oab: '',
  oabUf: 'SP',
}

function Botao({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending} className="botao botao-pequeno">
      {pending ? 'Salvando…' : children}
    </button>
  )
}

/** Os mesmos campos no cadastro e na edição. */
function Campos({
  valores,
  aoMudar,
  estado,
}: {
  valores: Valores
  aoMudar: (nome: keyof Valores, valor: string) => void
  estado: EstadoDoAdvogado
}) {
  const erro = (campo: string) =>
    estado?.erros?.[campo] === undefined ? null : (
      <p className="dica dica-erro">{estado.erros[campo]}</p>
    )

  return (
    <>
      <div className="mb-[13px]">
        <label className="campo-rotulo" htmlFor="nome">
          Nome, com o tratamento
        </label>
        <input
          id="nome"
          name="nome"
          className="campo-entrada"
          maxLength={120}
          placeholder="Dra. Maria de Souza"
          value={valores.nome}
          onChange={(e) => aoMudar('nome', e.target.value)}
        />
        {erro('nome')}
      </div>

      <div className="mb-[13px] flex flex-col gap-0 sm:flex-row sm:gap-3">
        <div className="flex-1">
          <label className="campo-rotulo" htmlFor="genero">
            Gênero (para a concordância)
          </label>
          <select
            id="genero"
            name="genero"
            className="campo-entrada"
            value={valores.genero}
            onChange={(e) => aoMudar('genero', e.target.value)}
          >
            <option value="M">Masculino — outorgado, inscrito</option>
            <option value="F">Feminino — outorgada, inscrita</option>
          </select>
          {erro('genero')}
        </div>
        <div className="flex-1">
          <label className="campo-rotulo" htmlFor="nacionalidade">
            Nacionalidade
          </label>
          <input
            id="nacionalidade"
            name="nacionalidade"
            className="campo-entrada"
            maxLength={60}
            value={valores.nacionalidade}
            onChange={(e) => aoMudar('nacionalidade', e.target.value)}
          />
          {erro('nacionalidade')}
        </div>
      </div>

      <div className="mb-[13px]">
        <label className="campo-rotulo" htmlFor="estadoCivil">
          Estado civil
        </label>
        <select
          id="estadoCivil"
          name="estadoCivil"
          className="campo-entrada"
          value={valores.estadoCivil}
          onChange={(e) => aoMudar('estadoCivil', e.target.value)}
        >
          <option value="">Escolha…</option>
          {ESTADOS_CIVIS.map((opcao) => (
            <option key={opcao} value={opcao}>
              {opcao}
            </option>
          ))}
        </select>
        {erro('estadoCivil')}
      </div>

      <div className="mb-[13px] flex gap-3">
        <div className="flex-1">
          <label className="campo-rotulo" htmlFor="oab">
            Número da OAB
          </label>
          <input
            id="oab"
            name="oab"
            className="campo-entrada mono"
            maxLength={20}
            placeholder="378.532"
            value={valores.oab}
            onChange={(e) => aoMudar('oab', e.target.value)}
          />
          {erro('oab')}
        </div>
        <div className="w-[90px]">
          <label className="campo-rotulo" htmlFor="oabUf">
            UF
          </label>
          <input
            id="oabUf"
            name="oabUf"
            className="campo-entrada mono uppercase"
            maxLength={2}
            value={valores.oabUf}
            onChange={(e) => aoMudar('oabUf', e.target.value)}
          />
          {erro('oabUf')}
        </div>
      </div>
    </>
  )
}

export function NovoAdvogado() {
  const [estado, criar] = useActionState(cadastrarAdvogado, undefined)
  const [valores, setValores] = useState<Valores>(VAZIO)
  const formulario = useRef<HTMLFormElement>(null)

  // Cadastrado: limpa o formulário para o próximo.
  useEffect(() => {
    if (estado?.sucesso === true) setValores(VAZIO)
  }, [estado])

  return (
    <div className="cartao">
      <div className="cartao-cabecalho">
        <h2>Novo advogado</h2>
      </div>
      <div className="cartao-corpo">
        {estado?.sucesso === true && (
          <div className="aviso aviso-info mb-3" role="status">
            <span aria-hidden="true">▲</span>
            <div>Advogado cadastrado. Já aparece em &ldquo;Gerar documento&rdquo;.</div>
          </div>
        )}
        <form action={criar} ref={formulario} noValidate>
          <Campos
            valores={valores}
            aoMudar={(nome, valor) => setValores((atual) => ({ ...atual, [nome]: valor }))}
            estado={estado}
          />
          <Botao>Cadastrar</Botao>
        </form>
      </div>
    </div>
  )
}

function Linha({ advogado }: { advogado: LinhaDeAdvogado }) {
  const [editando, setEditando] = useState(false)
  const [valores, setValores] = useState<Valores>({
    nome: advogado.nome,
    genero: advogado.feminino ? 'F' : 'M',
    nacionalidade: advogado.nacionalidade,
    estadoCivil:
      ESTADOS_CIVIS.find(
        (opcao) => opcao.toLocaleLowerCase('pt-BR') === advogado.estadoCivil.toLocaleLowerCase('pt-BR'),
      ) ?? '',
    oab: advogado.oab,
    oabUf: advogado.oabUf,
  })
  const [estado, salvar] = useActionState(salvarEdicaoDeAdvogado.bind(null, advogado.id), undefined)
  const [aviso, setAviso] = useState<string | null>(null)
  const [, iniciar] = useTransition()

  useEffect(() => {
    if (estado?.sucesso === true) setEditando(false)
  }, [estado])

  function executar(acao: () => Promise<EstadoDoAdvogado>): void {
    setAviso(null)
    iniciar(async () => {
      const resposta = await acao()
      if (resposta?.mensagem !== undefined) setAviso(resposta.mensagem)
    })
  }

  if (editando) {
    return (
      <form action={salvar} noValidate className="border-b border-prata-100 py-3 last:border-b-0">
        {estado?.mensagem !== undefined && (
          <p className="dica dica-erro mb-2">{estado.mensagem}</p>
        )}
        <Campos
          valores={valores}
          aoMudar={(nome, valor) => setValores((atual) => ({ ...atual, [nome]: valor }))}
          estado={estado}
        />
        <div className="flex items-center gap-2">
          <Botao>Salvar</Botao>
          <button
            type="button"
            onClick={() => setEditando(false)}
            className="text-[12px] text-texto-2 underline underline-offset-2"
          >
            cancelar
          </button>
        </div>
      </form>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-prata-100 py-3 last:border-b-0">
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-medium">{advogado.nome}</div>
        <div className="mt-0.5 text-[12px] text-texto-3">
          {advogado.nacionalidade}, {advogado.estadoCivil.toLocaleLowerCase('pt-BR')} · OAB/
          {advogado.oabUf} <span className="mono">{advogado.oab}</span>
        </div>
      </div>

      {advogado.padrao && <Etiqueta tom="ok">Padrão</Etiqueta>}
      {!advogado.ativo && <Etiqueta tom="neutra">Inativo</Etiqueta>}

      <div className="ml-auto flex flex-wrap items-center gap-2.5">
        <button
          type="button"
          onClick={() => setEditando(true)}
          className="text-[12px] text-texto-2 underline underline-offset-2"
        >
          Editar
        </button>
        {advogado.ativo && !advogado.padrao && (
          <button
            type="button"
            onClick={() => executar(() => definirComoPadrao(advogado.id))}
            className="text-[12px] text-texto-2 underline underline-offset-2"
          >
            Tornar padrão
          </button>
        )}
        {advogado.ativo ? (
          <button
            type="button"
            onClick={() => executar(() => desativarAdvogado(advogado.id))}
            className="text-[12px] text-erro underline underline-offset-2"
          >
            Desativar
          </button>
        ) : (
          <button
            type="button"
            onClick={() => executar(() => reativarAdvogado(advogado.id))}
            className="text-[12px] text-texto-2 underline underline-offset-2"
          >
            Reativar
          </button>
        )}
      </div>

      {aviso !== null && <p className="dica dica-erro w-full text-right">{aviso}</p>}
    </div>
  )
}

export function ListaDeAdvogados({ advogados }: { advogados: readonly LinhaDeAdvogado[] }) {
  return (
    <div className="cartao">
      <div className="cartao-cabecalho">
        <h2>Advogados</h2>
        <span className="ml-auto text-[12px] text-texto-2">
          {advogados.length === 1 ? '1 advogado' : `${advogados.length} advogados`}
        </span>
      </div>
      <div className="px-[18px] py-1.5">
        {advogados.map((advogado) => (
          <Linha key={advogado.id} advogado={advogado} />
        ))}
      </div>
    </div>
  )
}
