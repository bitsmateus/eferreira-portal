'use client'

import { useActionState, useEffect, useState } from 'react'
import { useFormStatus } from 'react-dom'

import { excluirClienteDaLista } from '@/app/painel/clientes/acoes'
import { descreverHistoricoDoCliente } from '@/lib/clientes'
import { ModalDeExclusaoForcada } from '@/componentes/modal-exclusao-forcada-de-cliente'

/**
 * O botão de excluir na própria tela de edição do cliente — ao lado de
 * "Salvar alterações" fica errado, então vive no topo da página, ao lado do
 * título. Mesmo padrão de `excluir-caso-botao.tsx`: sem portal, porque aqui
 * não há tabela com rolagem lateral cortando nada, e a mesma trava contra
 * apagar cliente com documento, andamento ou contrato assinado — com o
 * popup de exclusão forçada do administrador, igual ao de `menu-do-cliente.tsx`.
 */
function BotaoDeConfirmar() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending} className="botao botao-secundario text-erro">
      {pending ? 'Excluindo…' : 'Confirmar exclusão'}
    </button>
  )
}

export function ExcluirClienteBotao({
  clienteId,
  nome,
  souAdministrador,
}: {
  clienteId: string
  nome: string
  /** Só o administrador vê a opção de forçar a exclusão de um cliente com histórico. */
  souAdministrador: boolean
}) {
  const [confirmando, setConfirmando] = useState(false)
  const [modalForcadaAberto, setModalForcadaAberto] = useState(false)
  const [estado, excluir] = useActionState(
    excluirClienteDaLista.bind(null, clienteId),
    undefined,
  )

  // Qualquer resposta da ação — erro ou histórico — precisa sair da tela de
  // confirmação, que não mostra nenhuma delas. Sem isto, o componente ficava
  // preso ali e "Confirmar exclusão" parecia não fazer nada. Cliente com
  // histórico e sessão de administrador pula direto para o popup de
  // exclusão forçada, em vez de deixar a pessoa clicar de novo.
  useEffect(() => {
    if (estado === undefined) return
    setConfirmando(false)
    if (estado.situacao === 'tem_historico' && souAdministrador) {
      setModalForcadaAberto(true)
    }
  }, [estado, souAdministrador])

  if (confirmando) {
    return (
      <form action={excluir} className="flex items-center gap-2">
        <input type="hidden" name="confirmacao" value="excluir" />
        <span className="text-[12px] text-texto-2">
          Excluir <b className="text-texto">{nome}</b> de vez?
        </span>
        <BotaoDeConfirmar />
        <button
          type="button"
          onClick={() => setConfirmando(false)}
          className="text-[12px] text-texto-2 underline underline-offset-2"
        >
          cancelar
        </button>
      </form>
    )
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => setConfirmando(true)}
        className="botao botao-secundario text-erro"
      >
        Excluir cliente
      </button>

      {estado?.situacao === 'erro' && (
        <p className="max-w-[320px] text-right text-[11.5px] leading-relaxed text-erro">
          {estado.mensagem}
        </p>
      )}

      {estado?.situacao === 'tem_historico' && !souAdministrador && (
        <p className="max-w-[320px] text-right text-[11.5px] leading-relaxed text-erro">
          Este cliente não pode ser excluído porque já tem{' '}
          {descreverHistoricoDoCliente(estado)}. Apagar isso destruiria documento e
          histórico de processo. Peça a um administrador se for realmente necessário
          forçar.
        </p>
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
    </div>
  )
}
