'use client'

import Link from 'next/link'
import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { TipoDocumento } from '@prisma/client'

import { SeletorDeCaso } from '@/componentes/seletor-de-caso'
import {
  EXTENSOES_ACEITAS,
  LIMITE_DE_ARQUIVOS_POR_ENVIO,
  ROTULO_DO_TIPO,
  TIPOS_ACEITOS,
} from '@/lib/arquivos'
import { anexarNaPasta } from './acoes'

type Caso = { id: string; numeroProcesso: string | null; assunto: string }

function BotaoAnexar() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" className="botao" disabled={pending}>
      {pending ? 'Enviando…' : 'Anexar à pasta'}
    </button>
  )
}

export function FormularioDeAnexo({
  clienteId,
  casos,
}: {
  clienteId: string
  casos: readonly Caso[]
}) {
  const [estado, enviar] = useActionState(anexarNaPasta.bind(null, clienteId), undefined)
  const erros = estado?.erros ?? {}

  // Controlados pelo mesmo motivo dos outros formulários: a recusa não pode
  // desfazer o que já foi escolhido. O ARQUIVO é a exceção inevitável — o
  // navegador não deixa nenhum site preencher um campo de arquivo, então
  // depois de uma recusa ele precisa ser escolhido de novo. Por isso o aviso
  // abaixo do campo diz o limite ANTES de a pessoa tentar.
  const [tipo, setTipo] = useState<string>(TipoDocumento.ANEXO)
  // Sem padrão de propósito: a pessoa precisa escolher onde o documento vai.
  const [destino, setDestino] = useState<'' | 'CLIENTE' | 'CASO'>('')

  return (
    <form action={enviar} noValidate>
      {estado?.mensagem !== undefined && (
        <div className="aviso aviso-erro mb-4" role="alert">
          <span aria-hidden="true">▲</span>
          <div>{estado.mensagem}</div>
        </div>
      )}

      {/*
        `min-w-0` nos dois filhos do grid — mesma armadilha do
        `min-height: auto` do flexbox, no eixo horizontal.
      */}
      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <div className="cartao min-w-0">
          <div className="cartao-cabecalho">
            <h2>Arquivo</h2>
          </div>

          <div className="cartao-corpo">
            <div className="mb-[15px]">
              <label className="campo-rotulo" htmlFor="arquivo">
                Documentos
              </label>
              <input
                id="arquivo"
                name="arquivo"
                type="file"
                multiple
                required
                accept={[...Object.keys(TIPOS_ACEITOS), ...EXTENSOES_ACEITAS].join(',')}
                className="campo-entrada file:mr-3 file:rounded-md file:border-0 file:bg-prata-100 file:px-3 file:py-1.5 file:text-[12.5px] file:text-grafite-800"
              />
              {erros['arquivo'] !== undefined ? (
                <p className="dica dica-erro" role="alert">
                  {erros['arquivo']}
                </p>
              ) : (
                <p className="dica">
                  Pode escolher vários de uma vez (até {LIMITE_DE_ARQUIVOS_POR_ENVIO}, 100 MB
                  cada e 200 MB no total). O tipo e a pasta abaixo valem para todos.
                  Aceitos: {EXTENSOES_ACEITAS.join(', ')}.
                </p>
              )}
            </div>

            <div className="mb-[15px]">
              <label className="campo-rotulo" htmlFor="tipo">
                Tipo
              </label>
              <select
                id="tipo"
                name="tipo"
                className="campo-entrada"
                value={tipo}
                onChange={(evento) => setTipo(evento.target.value)}
              >
                {Object.values(TipoDocumento).map((tipo) => (
                  <option key={tipo} value={tipo}>
                    {ROTULO_DO_TIPO[tipo]}
                  </option>
                ))}
              </select>
              {erros['tipo'] !== undefined && (
                <p className="dica dica-erro" role="alert">
                  {erros['tipo']}
                </p>
              )}
            </div>

            <fieldset className="mb-[15px]">
              <legend className="campo-rotulo">
                Anexar em <span aria-hidden="true">*</span>
              </legend>
              <div className="flex flex-wrap gap-x-6 gap-y-2">
                <label className="flex items-center gap-2 text-[13.5px]">
                  <input
                    type="radio"
                    name="destino"
                    value="CLIENTE"
                    checked={destino === 'CLIENTE'}
                    onChange={() => setDestino('CLIENTE')}
                  />
                  Pasta do Cliente
                </label>
                <label className="flex items-center gap-2 text-[13.5px]">
                  <input
                    type="radio"
                    name="destino"
                    value="CASO"
                    checked={destino === 'CASO'}
                    onChange={() => setDestino('CASO')}
                  />
                  Pasta do Caso
                </label>
              </div>
              {erros['destino'] !== undefined ? (
                <p className="dica dica-erro" role="alert">
                  {erros['destino']}
                </p>
              ) : (
                <p className="dica">
                  Contrato, procuração e declaração são do cliente. Documento de um
                  processo específico vai na pasta do caso.
                </p>
              )}
            </fieldset>

            {destino === 'CASO' && (
              <div className="mb-[15px]">
                <label className="campo-rotulo" htmlFor="casoId">
                  Caso <span aria-hidden="true">*</span>
                </label>
                <SeletorDeCaso
                  id="casoId"
                  name="casoId"
                  casos={casos}
                  opcaoEmBranco="Escolha um caso…"
                />
                {erros['casoId'] !== undefined && (
                  <p className="dica dica-erro" role="alert">
                    {erros['casoId']}
                  </p>
                )}
              </div>
            )}

            <div className="flex items-center gap-2.5">
              <BotaoAnexar />
              <Link
                href={`/painel/clientes/${clienteId}`}
                className="botao botao-secundario"
              >
                Cancelar
              </Link>
            </div>
          </div>
        </div>

        <div className="aviso aviso-info min-w-0 self-start">
          <span aria-hidden="true">▲</span>
          <div>
            <b>Nenhum arquivo fica público.</b> O documento é guardado com nome
            sorteado pelo servidor e só sai por link temporário, gerado na hora e válido
            por poucos minutos, depois de conferido quem está pedindo. Cada abertura e
            cada download ficam registrados.
          </div>
        </div>
      </div>
    </form>
  )
}
