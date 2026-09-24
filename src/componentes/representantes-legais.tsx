'use client'

import Link from 'next/link'
import { useActionState, useEffect, useRef } from 'react'
import { useFormStatus } from 'react-dom'

import { formatarDocumento } from '@/lib/documento'
import { desvincularSocio, vincularSocio } from '@/app/painel/clientes/[id]/representantes/acoes'

export type Representante = {
  pessoaFisicaId: string
  nome: string
  documento: string
  qualificacao: string | null
  /** A qualificação do sócio é o que entra na procuração da empresa. */
  qualificacaoCompleta: boolean
}

function BotaoVincular() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" className="botao botao-pequeno" disabled={pending}>
      {pending ? 'Vinculando…' : 'Vincular'}
    </button>
  )
}

function BotaoDesvincular({
  empresaId,
  pessoaFisicaId,
}: {
  empresaId: string
  pessoaFisicaId: string
}) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      className="botao botao-fantasma botao-pequeno"
      disabled={pending}
      formAction={desvincularSocio.bind(null, empresaId, pessoaFisicaId)}
    >
      {pending ? '…' : 'Desvincular'}
    </button>
  )
}

/**
 * `empresa`: os sócios que assinam por uma pessoa jurídica.
 * `menor`: o responsável por um cliente pessoa física menor de idade (a
 * procuração de menor, modelo de 24/09/2026) — é o mesmo vínculo, com outras
 * palavras. Cliente pessoa física com responsável vinculado = menor.
 */
export type VarianteDoVinculo = 'empresa' | 'menor'

const TEXTOS = {
  empresa: {
    titulo: 'Representantes legais',
    contagem: ['1 sócio', 'sócios'],
    vazio:
      'A procuração e o contrato de uma empresa são assinados pelo representante legal, e a qualificação que entra no documento é a dele. Sem sócio vinculado, não há como gerar os documentos desta empresa.',
    vazioTitulo: 'Nenhum sócio vinculado.',
    campo: 'CPF do sócio',
    placeholder: 'sócio administrador',
    dica: 'O sócio precisa já estar cadastrado como cliente pessoa física.',
  },
  menor: {
    titulo: 'Responsável legal (cliente menor de idade)',
    contagem: ['1 responsável', 'responsáveis'],
    vazio:
      'Só para cliente menor de idade: vinculando o responsável, a procuração sai no modelo de menor representado, com a qualificação dele, e é ele quem assina. Cliente maior de idade não precisa de nada aqui.',
    vazioTitulo: 'Nenhum responsável vinculado.',
    campo: 'CPF do responsável',
    placeholder: 'genitora, genitor, tutor…',
    dica: 'O responsável precisa já estar cadastrado como cliente pessoa física.',
  },
} as const

export function RepresentantesLegais({
  empresaId,
  representantes,
  variante = 'empresa',
}: {
  empresaId: string
  representantes: readonly Representante[]
  variante?: VarianteDoVinculo
}) {
  const textos = TEXTOS[variante]
  const [estado, enviar] = useActionState(vincularSocio.bind(null, empresaId), undefined)
  const formulario = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (estado?.sucesso === true) formulario.current?.reset()
  }, [estado])

  return (
    <div className="cartao">
      <div className="cartao-cabecalho">
        <h2>{textos.titulo}</h2>
        <span className="ml-auto text-[12px] text-texto-2">
          {representantes.length === 1
            ? textos.contagem[0]
            : `${representantes.length} ${textos.contagem[1]}`}
        </span>
      </div>

      <div className="cartao-corpo">
        {representantes.length === 0 ? (
          <div
            className={`aviso ${variante === 'empresa' ? 'aviso-atencao' : 'aviso-info'} mb-4`}
          >
            <span aria-hidden="true">▲</span>
            <div>
              <b>{textos.vazioTitulo}</b> {textos.vazio}
            </div>
          </div>
        ) : (
          <div className="mb-4">
            {representantes.map((socio) => (
              <div
                key={socio.pessoaFisicaId}
                className="flex flex-wrap items-center gap-3 border-b border-prata-100 py-2.5 last:border-b-0"
              >
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/painel/clientes/${socio.pessoaFisicaId}`}
                    className="text-[13px] font-medium underline decoration-borda underline-offset-2 hover:decoration-texto-2"
                  >
                    {socio.nome}
                  </Link>
                  <div className="mono mt-0.5 text-[11.5px] text-texto-3">
                    {formatarDocumento(socio.documento)}
                    {socio.qualificacao !== null && ` · ${socio.qualificacao}`}
                  </div>
                  {!socio.qualificacaoCompleta && (
                    <p className="dica dica-erro">
                      Cadastro incompleto: falta RG ou nome da mãe, que a procuração
                      exige.
                    </p>
                  )}
                </div>

                <form>
                  <BotaoDesvincular
                    empresaId={empresaId}
                    pessoaFisicaId={socio.pessoaFisicaId}
                  />
                </form>
              </div>
            ))}
          </div>
        )}

        <form action={enviar} ref={formulario} noValidate>
          {estado?.mensagem !== undefined && (
            <div className="aviso aviso-erro mb-3" role="alert">
              <span aria-hidden="true">▲</span>
              <div>{estado.mensagem}</div>
            </div>
          )}

          <div className="flex flex-col gap-0 sm:flex-row sm:gap-3">
            <div className="flex-1">
              <label className="campo-rotulo" htmlFor="documento">
                {textos.campo}
              </label>
              <input
                id="documento"
                name="documento"
                inputMode="numeric"
                required
                className="campo-entrada mono"
                placeholder="000.000.000-00"
              />
            </div>
            <div className="flex-1">
              <label className="campo-rotulo" htmlFor="qualificacao">
                Qualificação
              </label>
              <input
                id="qualificacao"
                name="qualificacao"
                className="campo-entrada"
                placeholder={textos.placeholder}
              />
            </div>
          </div>

          {estado?.erros?.['documento'] !== undefined ? (
            <p className="dica dica-erro" role="alert">
              {estado.erros['documento']}
            </p>
          ) : (
            <p className="dica">{textos.dica}</p>
          )}

          <div className="mt-3">
            <BotaoVincular />
          </div>
        </form>
      </div>
    </div>
  )
}

export type EmpresaRepresentada = {
  pessoaJuridicaId: string
  nome: string
  documento: string
  qualificacao: string | null
}

/**
 * A outra ponta do mesmo vínculo — pedido do escritório em 22/09/2026: quem
 * abre a ficha do SÓCIO (pessoa física) vê aqui quais empresas ele representa,
 * em vez de só descobrir isso abrindo a ficha de cada empresa uma por uma. O
 * dado (`empresasQueRepresenta`) já vinha sendo buscado em `obterCliente`
 * desde a Sprint 1, mas nunca tinha tela — só faltava isto.
 *
 * Só leitura: vincular e desvincular continuam feitos do lado da empresa
 * (`RepresentantesLegais`, acima), que é onde "quem assina por quem" é
 * decidido.
 */
export function EmpresasQueRepresenta({
  empresas,
}: {
  empresas: readonly EmpresaRepresentada[]
}) {
  if (empresas.length === 0) return null

  return (
    <div className="cartao">
      <div className="cartao-cabecalho">
        <h2>Representa</h2>
        <span className="ml-auto text-[12px] text-texto-2">
          {empresas.length === 1 ? '1 empresa' : `${empresas.length} empresas`}
        </span>
      </div>

      <div className="cartao-corpo">
        {empresas.map((empresa) => (
          <div
            key={empresa.pessoaJuridicaId}
            className="flex flex-wrap items-center gap-3 border-b border-prata-100 py-2.5 last:border-b-0"
          >
            <div className="min-w-0 flex-1">
              <Link
                href={`/painel/clientes/${empresa.pessoaJuridicaId}`}
                className="text-[13px] font-medium underline decoration-borda underline-offset-2 hover:decoration-texto-2"
              >
                {empresa.nome}
              </Link>
              <div className="mono mt-0.5 text-[11.5px] text-texto-3">
                {formatarDocumento(empresa.documento)}
                {empresa.qualificacao !== null && ` · ${empresa.qualificacao}`}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
