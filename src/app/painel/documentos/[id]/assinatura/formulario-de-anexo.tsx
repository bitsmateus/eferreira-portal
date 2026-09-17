'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { PapelDaParte } from '@prisma/client'

import { ROTULO_DO_PAPEL, ROTULO_DO_PAPEL_DA_PARTE } from '@/lib/rotulos-de-assinatura'
import type { LinhaDeParte } from '@/lib/partes'
import type { ParteQueAssina } from '@/lib/assinaturas'
import { enviarDocumentoParaAssinatura, prepararEnvioDeAnexo } from './acoes'

type Extra = { nome: string; email: string; papel: PapelDaParte }
type SignatarioEscolhido = { nome: string; email: string; papel: PapelDaParte }

function Botao({
  children,
  variante = 'principal',
}: {
  children: React.ReactNode
  variante?: 'principal' | 'secundario' | 'fantasma'
}) {
  const { pending } = useFormStatus()
  const classe =
    variante === 'principal'
      ? 'botao'
      : variante === 'secundario'
        ? 'botao botao-secundario'
        : 'botao botao-fantasma'
  return (
    <button type="submit" disabled={pending} className={classe}>
      {pending ? 'Aguarde…' : children}
    </button>
  )
}

/**
 * Documento AVULSO (ANEXO): ninguém assina "automaticamente" como no
 * contrato ou na procuração. A pessoa escolhe, aqui, quem vai assinar —
 * partes já cadastradas (parte contrária, testemunha, advogado externo) e/ou
 * gente digitada na hora — antes de qualquer coisa ser mandada.
 *
 * Dois passos, igual ao envio normal: "Revisar" monta a lista final e mostra
 * quantos créditos restam, sem gastar nada; só "Confirmar o envio" manda de
 * verdade. A lista de signatários viaja entre os dois passos como JSON num
 * campo escondido — o servidor confere tudo de novo, nunca confia só no que
 * veio da tela (regra 2 aplicada a este formulário).
 */
export function FormularioDeAnexo({
  documentoId,
  partesCadastradas,
}: {
  documentoId: string
  partesCadastradas: readonly LinhaDeParte[]
}) {
  const [selecionadas, setSelecionadas] = useState<ReadonlySet<string>>(new Set())
  const [extras, setExtras] = useState<Extra[]>([])
  const [novo, setNovo] = useState<Extra>({ nome: '', email: '', papel: PapelDaParte.OUTROS })

  const [preparo, revisar] = useActionState(
    prepararEnvioDeAnexo.bind(null, documentoId),
    undefined,
  )
  const [envio, enviar] = useActionState(
    enviarDocumentoParaAssinatura.bind(null, documentoId),
    undefined,
  )
  const [confirmando, setConfirmando] = useState(false)

  const escolhidos: SignatarioEscolhido[] = [
    ...partesCadastradas
      .filter((parte) => selecionadas.has(parte.id))
      .map((parte) => ({ nome: parte.nome, email: parte.email, papel: parte.papel })),
    ...extras,
  ]
  const avulsosJson = JSON.stringify(escolhidos)

  function alternar(parteId: string): void {
    setSelecionadas((atual) => {
      const seguinte = new Set(atual)
      if (seguinte.has(parteId)) seguinte.delete(parteId)
      else seguinte.add(parteId)
      return seguinte
    })
  }

  function adicionarExtra(): void {
    if (novo.nome.trim() === '' || novo.email.trim() === '') return
    setExtras((atual) => [...atual, novo])
    setNovo({ nome: '', email: '', papel: PapelDaParte.OUTROS })
  }

  function removerExtra(indice: number): void {
    setExtras((atual) => atual.filter((_, i) => i !== indice))
  }

  // A revisão veio pronta: mostra a lista final e o botão de confirmar,
  // igual ao envio dos demais tipos de documento.
  if (preparo?.situacao === 'pronto') {
    return (
      <>
        {envio?.erro !== undefined && (
          <div className="aviso aviso-erro mb-4" role="alert">
            <span aria-hidden="true">▲</span>
            <div>{envio.erro}</div>
          </div>
        )}
        {envio?.mensagem !== undefined && (
          <div className="aviso aviso-ok mb-4" role="status">
            <span aria-hidden="true">●</span>
            <div>{envio.mensagem}</div>
          </div>
        )}

        <p className="mb-3 text-[12.5px] leading-relaxed text-texto-2">
          Quem recebe o e-mail de assinatura:
        </p>
        <ul className="mb-4">
          {preparo.partes.map((parte, indice) => (
            <li
              key={`${parte.papel}-${parte.email ?? indice}`}
              className="flex flex-wrap items-baseline gap-x-2 border-b border-prata-100 py-2.5 last:border-b-0"
            >
              <span className="text-[13px] font-medium">{parte.nome}</span>
              <span className="text-[11.5px] text-texto-3">
                {ROTULO_DO_PAPEL[parte.papel as ParteQueAssina['papel']] ?? parte.papel}
              </span>
              <span className="mono ml-auto text-[12.5px] text-texto-2">
                {parte.email ?? '— sem e-mail —'}
              </span>
            </li>
          ))}
        </ul>

        <p className="mb-4 text-[12px] leading-relaxed text-texto-3">
          {preparo.creditosRestantes === null ? (
            <>Não foi possível consultar o saldo da D4Sign agora.</>
          ) : (
            <>
              A conta do escritório tem{' '}
              <strong className="text-texto-1">
                {preparo.creditosRestantes}{' '}
                {preparo.creditosRestantes === 1 ? 'crédito' : 'créditos'}
              </strong>{' '}
              — este envio gasta um.
            </>
          )}
        </p>

        {confirmando ? (
          <form action={enviar}>
            <input type="hidden" name="confirmacao" value="enviar" />
            <input type="hidden" name="avulsosJson" value={avulsosJson} readOnly />
            <div className="aviso aviso-atencao mb-3">
              <span aria-hidden="true">▲</span>
              <div>
                Ao confirmar, {preparo.partes.length === 1 ? 'a pessoa' : 'as pessoas'}{' '}
                da lista acima {preparo.partes.length === 1 ? 'recebe' : 'recebem'} agora
                um e-mail da D4Sign, e um crédito do escritório é consumido.
                <strong> Isso não se desfaz.</strong>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Botao>Confirmar o envio</Botao>
              <button
                type="button"
                onClick={() => setConfirmando(false)}
                className="text-[12.5px] text-texto-2 underline underline-offset-2"
              >
                cancelar
              </button>
            </div>
          </form>
        ) : (
          <button type="button" onClick={() => setConfirmando(true)} className="botao">
            {preparo.retomando ? 'Tentar o envio de novo' : 'Enviar para assinatura'}
          </button>
        )}
      </>
    )
  }

  // Ainda escolhendo quem assina.
  return (
    <form action={revisar}>
      <input type="hidden" name="avulsosJson" value={avulsosJson} readOnly />

      {preparo?.situacao === 'erro' && (
        <div className="aviso aviso-erro mb-4" role="alert">
          <span aria-hidden="true">▲</span>
          <div>{preparo.mensagem}</div>
        </div>
      )}

      {partesCadastradas.length > 0 && (
        <div className="mb-[15px]">
          <span className="campo-rotulo">Do cadastro de partes</span>
          <div className="rounded-md border border-borda">
            {partesCadastradas.map((parte) => (
              <label
                key={parte.id}
                className="flex items-center gap-2.5 border-b border-prata-100 px-3 py-2 text-[13px] last:border-b-0"
              >
                <input
                  type="checkbox"
                  checked={selecionadas.has(parte.id)}
                  onChange={() => alternar(parte.id)}
                />
                <span className="min-w-0 flex-1 truncate">{parte.nome}</span>
                <span className="text-[11.5px] text-texto-3">
                  {ROTULO_DO_PAPEL_DA_PARTE[parte.papel]}
                </span>
              </label>
            ))}
          </div>
          <p className="dica">
            Faltou alguém? <a href="/painel/partes" className="underline underline-offset-2">Cadastre em Partes</a> ou digite abaixo, na hora.
          </p>
        </div>
      )}

      <div className="mb-[15px]">
        <span className="campo-rotulo">Adicionar alguém na hora</span>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            placeholder="Nome"
            className="campo-entrada flex-1"
            value={novo.nome}
            onChange={(evento) => setNovo((atual) => ({ ...atual, nome: evento.target.value }))}
          />
          <input
            placeholder="E-mail"
            type="email"
            className="campo-entrada flex-1"
            value={novo.email}
            onChange={(evento) => setNovo((atual) => ({ ...atual, email: evento.target.value }))}
          />
          <select
            className="campo-entrada sm:w-[160px]"
            value={novo.papel}
            onChange={(evento) =>
              setNovo((atual) => ({ ...atual, papel: evento.target.value as PapelDaParte }))
            }
          >
            {Object.values(PapelDaParte).map((papel) => (
              <option key={papel} value={papel}>
                {ROTULO_DO_PAPEL_DA_PARTE[papel]}
              </option>
            ))}
          </select>
          <button type="button" onClick={adicionarExtra} className="botao botao-secundario">
            Adicionar
          </button>
        </div>
        <p className="dica">
          Fica só neste envio — não entra no cadastro de Partes a não ser que você
          cadastre por lá.
        </p>
      </div>

      {extras.length > 0 && (
        <ul className="mb-[15px]">
          {extras.map((extra, indice) => (
            <li
              key={`${extra.email}-${indice}`}
              className="flex flex-wrap items-baseline gap-x-2 border-b border-prata-100 py-2 last:border-b-0"
            >
              <span className="text-[13px] font-medium">{extra.nome}</span>
              <span className="text-[11.5px] text-texto-3">
                {ROTULO_DO_PAPEL_DA_PARTE[extra.papel]}
              </span>
              <span className="mono text-[12.5px] text-texto-2">{extra.email}</span>
              <button
                type="button"
                onClick={() => removerExtra(indice)}
                className="ml-auto text-[12px] text-erro underline underline-offset-2"
              >
                remover
              </button>
            </li>
          ))}
        </ul>
      )}

      <Botao variante="secundario">Revisar envio</Botao>
    </form>
  )
}
