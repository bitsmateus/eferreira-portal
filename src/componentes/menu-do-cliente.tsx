'use client'

import Link from 'next/link'
import { createPortal } from 'react-dom'
import { useActionState, useEffect, useRef, useState } from 'react'
import { useFormStatus } from 'react-dom'

import { excluirClienteDaLista } from '@/app/painel/clientes/acoes'
import { descreverHistoricoDoCliente } from '@/lib/clientes'
import { ModalDeExclusaoForcada } from '@/componentes/modal-exclusao-forcada-de-cliente'

/** Largura do menu, em pixels — usada para calcular onde ele cabe na tela. */
const LARGURA_DO_MENU = 230

/**
 * O menu de cada linha da lista de clientes: abrir, editar e excluir.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * POR QUE O MENU É DESENHADO FORA DA TABELA (VIA PORTAL)
 *
 * A tabela rola de lado em telas estreitas (`.rolagem-lateral`, com
 * `overflow-x: auto`). Pela regra do CSS, um elemento com rolagem horizontal
 * não-visível também corta o que passa da borda vertical — mesmo que ninguém
 * tenha pedido isso. Um menu suspenso `position: absolute` dentro da tabela
 * ficava cortado pela própria borda da linha, exatamente como reportado.
 *
 * A saída é desenhar o menu fora da árvore da tabela, direto no `<body>`
 * (`createPortal`), com `position: fixed` calculado a partir da posição do
 * botão na TELA — não da linha, que pode estar dentro de qualquer contêiner
 * com rolagem. Rolar a página ou a tabela fecha o menu em vez de deixá-lo
 * flutuando num lugar errado: fechar é mais simples e mais seguro do que
 * recalcular a posição a cada pixel de rolagem.
 * ─────────────────────────────────────────────────────────────────────────
 */
function BotaoDeConfirmar() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-md px-2.5 py-1.5 text-left text-[12.5px] text-erro hover:bg-prata-100"
    >
      {pending ? 'Excluindo…' : 'Confirmar exclusão'}
    </button>
  )
}

export function MenuDoCliente({
  clienteId,
  nome,
  souAdministrador,
}: {
  clienteId: string
  nome: string
  /** Só o administrador vê a opção de forçar a exclusão de um cliente com histórico. */
  souAdministrador: boolean
}) {
  const [aberto, setAberto] = useState(false)
  const [confirmando, setConfirmando] = useState(false)
  const [modalForcadaAberto, setModalForcadaAberto] = useState(false)
  const [posicao, setPosicao] = useState<{ top: number; left: number } | null>(null)
  const [estado, excluir] = useActionState(
    excluirClienteDaLista.bind(null, clienteId),
    undefined,
  )
  const botaoRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  function fechar() {
    setAberto(false)
    setConfirmando(false)
  }

  function abrir() {
    const retangulo = botaoRef.current?.getBoundingClientRect()
    if (retangulo === undefined) return

    // O menu tenta ficar alinhado à direita do botão, como antes; se isso
    // jogaria parte dele para fora da tela (telas estreitas), encosta na
    // borda em vez de cortar.
    const esquerda = Math.max(
      8,
      Math.min(retangulo.right - LARGURA_DO_MENU, window.innerWidth - LARGURA_DO_MENU - 8),
    )
    setPosicao({ top: retangulo.bottom + 4, left: esquerda })
    setAberto(true)
  }

  function alternar() {
    if (aberto) {
      fechar()
      return
    }
    abrir()
  }

  // Fechar clicando fora, no Esc, ou rolando qualquer coisa.
  useEffect(() => {
    if (!aberto) return

    function noDocumento(evento: MouseEvent) {
      const alvo = evento.target as Node
      const dentroDoBotao = botaoRef.current?.contains(alvo) ?? false
      const dentroDoMenu = menuRef.current?.contains(alvo) ?? false
      if (!dentroDoBotao && !dentroDoMenu) fechar()
    }
    function noTeclado(evento: KeyboardEvent) {
      if (evento.key === 'Escape') fechar()
    }

    document.addEventListener('mousedown', noDocumento)
    document.addEventListener('keydown', noTeclado)
    // `capture: true` pega o scroll de QUALQUER contêiner rolável da página,
    // não só da janela — é assim que o scroll da tabela também fecha o menu,
    // mesmo o evento de scroll não borbulhando por padrão.
    window.addEventListener('scroll', fechar, true)
    window.addEventListener('resize', fechar)
    return () => {
      document.removeEventListener('mousedown', noDocumento)
      document.removeEventListener('keydown', noTeclado)
      window.removeEventListener('scroll', fechar, true)
      window.removeEventListener('resize', fechar)
    }
  }, [aberto])

  // A recusa precisa ficar visível: sem isto o menu fecharia e a pessoa não
  // saberia por que nada aconteceu. Cliente com histórico e sessão de
  // administrador pula direto para o popup de exclusão forçada, em vez de
  // reabrir o menu só para mostrar um texto.
  useEffect(() => {
    if (estado?.situacao === 'tem_historico' && souAdministrador) {
      setAberto(false)
      setConfirmando(false)
      setModalForcadaAberto(true)
      return
    }
    if (estado !== undefined) abrir()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado])

  return (
    <>
      <button
        ref={botaoRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-label={`Ações de ${nome}`}
        onClick={(evento) => {
          // A linha inteira é um link esticado (ver clientes/page.tsx): sem
          // isto, o clique no botão também navegaria para a ficha.
          evento.stopPropagation()
          alternar()
        }}
        className="botao botao-secundario botao-pequeno"
      >
        <span aria-hidden="true">⋯</span>
      </button>

      {aberto &&
        posicao !== null &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            onClick={(evento) => evento.stopPropagation()}
            style={{
              position: 'fixed',
              top: posicao.top,
              left: posicao.left,
              width: LARGURA_DO_MENU,
            }}
            className="z-50 rounded-lg border border-borda bg-superficie p-1 shadow-lg"
          >
            <Link
              role="menuitem"
              href={`/painel/clientes/${clienteId}`}
              className="block rounded-md px-2.5 py-1.5 text-[12.5px] hover:bg-prata-100"
            >
              Abrir a ficha
            </Link>
            <Link
              role="menuitem"
              href={`/painel/clientes/${clienteId}/editar`}
              className="block rounded-md px-2.5 py-1.5 text-[12.5px] hover:bg-prata-100"
            >
              Editar o cadastro
            </Link>

            <div className="my-1 border-t border-prata-100" />

            {estado?.situacao === 'erro' && (
              <p className="px-2.5 py-1.5 text-[11.5px] leading-relaxed text-erro">
                {estado.mensagem}
              </p>
            )}

            {/*
              Quando é administrador, o efeito acima já fechou o menu e abriu
              o popup — este texto só aparece para o operador, que não tem
              como forçar.
            */}
            {estado?.situacao === 'tem_historico' && !souAdministrador && (
              <p className="px-2.5 py-1.5 text-[11.5px] leading-relaxed text-erro">
                Este cliente não pode ser excluído porque já tem{' '}
                {descreverHistoricoDoCliente(estado)}. Apagar isso destruiria documento e
                histórico de processo. Peça a um administrador se for realmente
                necessário forçar.
              </p>
            )}

            {confirmando ? (
              <form action={excluir}>
                <input type="hidden" name="confirmacao" value="excluir" />
                <p className="px-2.5 py-1.5 text-[11.5px] leading-relaxed text-texto-2">
                  Excluir <b className="text-texto">{nome}</b> de vez? Só é possível
                  enquanto o cadastro não tiver documento nem andamento.
                </p>
                <BotaoDeConfirmar />
                <button
                  type="button"
                  onClick={() => setConfirmando(false)}
                  className="w-full rounded-md px-2.5 py-1.5 text-left text-[12px] text-texto-2 hover:bg-prata-100"
                >
                  Cancelar
                </button>
              </form>
            ) : (
              <button
                type="button"
                role="menuitem"
                onClick={() => setConfirmando(true)}
                className="block w-full rounded-md px-2.5 py-1.5 text-left text-[12.5px] text-erro hover:bg-prata-100"
              >
                Excluir o cliente
              </button>
            )}
          </div>,
          document.body,
        )}

      {modalForcadaAberto && estado?.situacao === 'tem_historico' && (
        <ModalDeExclusaoForcada
          nome={nome}
          documentos={estado.documentos}
          andamentos={estado.andamentos}
          contratoAssinado={estado.contratoAssinado}
          acao={excluirClienteDaLista.bind(null, clienteId)}
          aoFechar={() => setModalForcadaAberto(false)}
        />
      )}
    </>
  )
}
