'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { PerfilUsuario, SituacaoUsuario } from '@prisma/client'

import { Etiqueta } from '@/componentes/etiqueta'
import { formatarData, formatarDataHora } from '@/lib/datas'
import type { LinhaDeUsuario } from '@/lib/usuarios'
import {
  cadastrarUsuario,
  desativarUsuario,
  reativarUsuario,
  redefinirSenhaDoUsuario,
  salvarEdicaoDeUsuario,
} from './acoes'

const NOME_DO_PERFIL: Record<PerfilUsuario, string> = {
  OPERADOR: 'Operador',
  ADMINISTRADOR: 'Administrador',
  CLIENTE: 'Cliente',
}

/** Só estes dois entram no seletor — regra 2 conferida de novo no domínio. */
const PERFIS_DA_EQUIPE = [PerfilUsuario.OPERADOR, PerfilUsuario.ADMINISTRADOR] as const

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
      ? 'botao botao-pequeno'
      : variante === 'secundario'
        ? 'botao botao-secundario botao-pequeno'
        : 'botao botao-fantasma botao-pequeno'

  return (
    <button type="submit" disabled={pending} className={classe}>
      {children}
    </button>
  )
}

/**
 * A senha gerada pelo sistema aparece uma vez só — na criação e na
 * redefinição —, igual à chave de API em `credenciais.tsx`. Depois desta
 * tela só existe o hash: se perder, é preciso redefinir de novo.
 */
function SenhaGerada({ senha, aoFechar }: { senha: string; aoFechar: () => void }) {
  const [copiada, setCopiada] = useState(false)

  return (
    <div className="cartao">
      <div className="cartao-cabecalho">
        <h2>Senha gerada</h2>
      </div>
      <div className="cartao-corpo">
        <div className="aviso aviso-atencao mb-3">
          <span aria-hidden="true">▲</span>
          <div>
            <b>A senha aparece uma vez só.</b> Copie agora e repasse por um canal
            seguro. Depois desta tela ela vira só o hash — se perder, redefina de novo.
          </div>
        </div>

        <div className="mono select-all break-all rounded-md border border-borda bg-prata-100 p-3 text-[12.5px]">
          {senha}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="botao botao-secundario botao-pequeno"
            onClick={() => {
              void navigator.clipboard
                ?.writeText(senha)
                .then(() => setCopiada(true))
                .catch(() => setCopiada(false))
            }}
          >
            {copiada ? 'Copiada' : 'Copiar'}
          </button>
          <button
            type="button"
            className="botao botao-fantasma botao-pequeno"
            onClick={aoFechar}
          >
            Já repassei
          </button>
        </div>
      </div>
    </div>
  )
}

export function NovoUsuario() {
  const [estado, criar] = useActionState(cadastrarUsuario, undefined)
  const [senhaVisivel, setSenhaVisivel] = useState(true)

  // Controlados, como nos demais formulários: e-mail repetido é a recusa mais
  // comum aqui, e ela não pode levar junto o nome já digitado.
  const [campos, setCampos] = useState({
    nome: '',
    email: '',
    perfil: String(PerfilUsuario.OPERADOR),
  })
  const definir = (nome: keyof typeof campos, valor: string) =>
    setCampos((atual) => ({ ...atual, [nome]: valor }))

  if (estado?.senha !== undefined && senhaVisivel) {
    return <SenhaGerada senha={estado.senha} aoFechar={() => setSenhaVisivel(false)} />
  }

  return (
    <div className="cartao">
      <div className="cartao-cabecalho">
        <h2>Novo usuário</h2>
      </div>
      <div className="cartao-corpo">
        {estado?.mensagem !== undefined && (
          <div className="aviso aviso-erro mb-3" role="alert">
            <span aria-hidden="true">▲</span>
            <div>{estado.mensagem}</div>
          </div>
        )}

        {estado?.sucesso !== undefined && (
          <div className="aviso aviso-info mb-3" role="status">
            <span aria-hidden="true">▲</span>
            <div>{estado.sucesso}</div>
          </div>
        )}

        <form action={criar} onSubmit={() => setSenhaVisivel(true)}>
          <div className="mb-[15px]">
            <label className="campo-rotulo" htmlFor="nome">
              Nome
            </label>
            <input
              id="nome"
              name="nome"
              type="text"
              required
              maxLength={120}
              className="campo-entrada"
              placeholder="Nome completo"
              value={campos.nome}
              onChange={(evento) => definir('nome', evento.target.value)}
            />
            {estado?.erros?.['nome'] !== undefined && (
              <p className="dica dica-erro">{estado.erros['nome']}</p>
            )}
          </div>

          <div className="mb-[15px]">
            <label className="campo-rotulo" htmlFor="email">
              E-mail
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              maxLength={180}
              className="campo-entrada"
              placeholder="nome@eferreira.adv.br"
              value={campos.email}
              onChange={(evento) => definir('email', evento.target.value)}
            />
            {estado?.erros?.['email'] !== undefined && (
              <p className="dica dica-erro">{estado.erros['email']}</p>
            )}
          </div>

          <div className="mb-[15px]">
            <label className="campo-rotulo" htmlFor="perfil">
              Perfil
            </label>
            <select
              id="perfil"
              name="perfil"
              value={campos.perfil}
              onChange={(evento) => definir('perfil', evento.target.value)}
              className="campo-entrada"
            >
              {PERFIS_DA_EQUIPE.map((perfil) => (
                <option key={perfil} value={perfil}>
                  {NOME_DO_PERFIL[perfil]}
                </option>
              ))}
            </select>
            {estado?.erros?.['perfil'] !== undefined && (
              <p className="dica dica-erro">{estado.erros['perfil']}</p>
            )}
          </div>

          <div className="mb-[15px]">
            <label className="campo-rotulo" htmlFor="senha">
              Senha (opcional)
            </label>
            <input
              id="senha"
              name="senha"
              type="text"
              autoComplete="off"
              maxLength={128}
              className="campo-entrada"
              placeholder="Deixe em branco para o sistema sortear"
            />
            {estado?.erros?.['senha'] !== undefined && (
              <p className="dica dica-erro">{estado.erros['senha']}</p>
            )}
          </div>

          <Botao>Cadastrar</Botao>
          <p className="dica">
            Em branco, a senha é gerada pelo sistema e aparece na tela em seguida —
            repasse por um canal seguro. Digitada, mínimo de 8 caracteres.
          </p>
        </form>
      </div>
    </div>
  )
}

function LinhaDeUsuarioNaLista({
  usuario,
  souEu,
}: {
  usuario: LinhaDeUsuario
  souEu: boolean
}) {
  const [editando, setEditando] = useState(false)
  const [confirmandoSenha, setConfirmandoSenha] = useState(false)
  const [confirmandoDesativacao, setConfirmandoDesativacao] = useState(false)
  const [senhaVisivel, setSenhaVisivel] = useState(true)

  const [estadoEdicao, salvar] = useActionState(
    salvarEdicaoDeUsuario.bind(null, usuario.id),
    undefined,
  )
  const [estadoSenha, gerarNovaSenha] = useActionState(
    redefinirSenhaDoUsuario.bind(null, usuario.id),
    undefined,
  )
  const [estadoSituacao, alterarSituacao] = useActionState(
    usuario.situacao === SituacaoUsuario.ATIVO
      ? desativarUsuario.bind(null, usuario.id)
      : reativarUsuario.bind(null, usuario.id),
    undefined,
  )

  if (estadoSenha?.senha !== undefined && senhaVisivel) {
    return (
      <div className="border-b border-prata-100 py-3 last:border-b-0">
        <SenhaGerada
          senha={estadoSenha.senha}
          aoFechar={() => {
            setSenhaVisivel(false)
            setConfirmandoSenha(false)
          }}
        />
      </div>
    )
  }

  if (editando) {
    return (
      <form
        action={salvar}
        className="flex flex-wrap items-start gap-2.5 border-b border-prata-100 py-3 last:border-b-0"
      >
        <div className="min-w-[160px] flex-1">
          <input
            name="nome"
            defaultValue={usuario.nome}
            required
            maxLength={120}
            className="campo-entrada"
          />
          {estadoEdicao?.erros?.['nome'] !== undefined && (
            <p className="dica dica-erro">{estadoEdicao.erros['nome']}</p>
          )}
        </div>

        <div className="min-w-[200px] flex-1">
          <input
            name="email"
            type="email"
            defaultValue={usuario.email}
            required
            maxLength={180}
            className="campo-entrada"
          />
          {estadoEdicao?.erros?.['email'] !== undefined && (
            <p className="dica dica-erro">{estadoEdicao.erros['email']}</p>
          )}
        </div>

        <div className="w-[160px]">
          <select name="perfil" defaultValue={usuario.perfil} className="campo-entrada">
            {PERFIS_DA_EQUIPE.map((perfil) => (
              <option key={perfil} value={perfil}>
                {NOME_DO_PERFIL[perfil]}
              </option>
            ))}
          </select>
        </div>

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

        {estadoEdicao?.mensagem !== undefined && (
          <p className="dica dica-erro w-full">{estadoEdicao.mensagem}</p>
        )}
      </form>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-prata-100 py-3 last:border-b-0">
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-medium">
          {usuario.nome}
          {souEu && <span className="ml-1.5 text-[11px] text-texto-3">(você)</span>}
        </div>
        <div className="mt-0.5 truncate text-[12px] text-texto-3">{usuario.email}</div>
        <div className="mt-1 text-[11.5px] text-texto-3">
          criado em <span className="mono">{formatarData(usuario.criadoEm)}</span>
          {' · '}
          {usuario.ultimoAcessoEm === null ? (
            'nunca entrou'
          ) : (
            <>
              último acesso em{' '}
              <span className="mono">{formatarDataHora(usuario.ultimoAcessoEm)}</span>
            </>
          )}
        </div>
      </div>

      <Etiqueta tom="neutra">{NOME_DO_PERFIL[usuario.perfil]}</Etiqueta>
      <Etiqueta tom={usuario.situacao === SituacaoUsuario.ATIVO ? 'ok' : 'neutra'}>
        {usuario.situacao === SituacaoUsuario.ATIVO ? 'Ativo' : 'Inativo'}
      </Etiqueta>

      <div className="ml-auto flex flex-wrap items-center gap-2.5">
        <button
          type="button"
          onClick={() => setEditando(true)}
          className="text-[12px] text-texto-2 underline underline-offset-2"
        >
          Editar
        </button>

        {!confirmandoSenha ? (
          <button
            type="button"
            onClick={() => setConfirmandoSenha(true)}
            className="text-[12px] text-texto-2 underline underline-offset-2"
          >
            Redefinir senha
          </button>
        ) : (
          <form action={gerarNovaSenha} className="flex flex-wrap items-center gap-1.5">
            <input type="hidden" name="confirmacao" value="redefinir" />
            <input
              name="senha"
              type="text"
              autoComplete="off"
              maxLength={128}
              className="campo-entrada w-[210px]"
              placeholder="Nova senha (vazio = sortear)"
              aria-label="Nova senha, ou vazio para o sistema sortear"
            />
            <Botao variante="fantasma">Confirmar</Botao>
            <button
              type="button"
              onClick={() => setConfirmandoSenha(false)}
              className="text-[12px] text-texto-2 underline underline-offset-2"
            >
              cancelar
            </button>
          </form>
        )}

        {usuario.situacao === SituacaoUsuario.ATIVO ? (
          !confirmandoDesativacao ? (
            <button
              type="button"
              onClick={() => setConfirmandoDesativacao(true)}
              className="text-[12px] text-erro underline underline-offset-2"
            >
              Desativar
            </button>
          ) : (
            <form action={alterarSituacao} className="flex items-center gap-1.5">
              <input type="hidden" name="confirmacao" value="desativar" />
              <Botao variante="fantasma">Confirmar</Botao>
              <button
                type="button"
                onClick={() => setConfirmandoDesativacao(false)}
                className="text-[12px] text-texto-2 underline underline-offset-2"
              >
                cancelar
              </button>
            </form>
          )
        ) : (
          <form action={alterarSituacao}>
            <Botao variante="secundario">Reativar</Botao>
          </form>
        )}
      </div>

      {estadoSenha?.mensagem !== undefined && (
        <p className="dica dica-erro w-full text-right">{estadoSenha.mensagem}</p>
      )}
      {estadoSenha?.sucesso !== undefined && (
        <p className="dica w-full text-right">{estadoSenha.sucesso}</p>
      )}
      {estadoSituacao?.erro !== undefined && (
        <p className="dica dica-erro w-full text-right">{estadoSituacao.erro}</p>
      )}
    </div>
  )
}

export function ListaDeUsuarios({
  usuarios,
  idDoUsuarioAtual,
}: {
  usuarios: readonly LinhaDeUsuario[]
  idDoUsuarioAtual: string
}) {
  if (usuarios.length === 0) {
    return (
      <div className="cartao">
        <div className="cartao-cabecalho">
          <h2>Usuários</h2>
        </div>
        <div className="px-[18px] py-9 text-center">
          <p className="mb-1 text-[13.5px] font-medium text-texto-2">
            Nenhum usuário cadastrado.
          </p>
          <p className="text-[12.5px] text-texto-3">
            Cadastre operadores e administradores ao lado.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="cartao">
      <div className="cartao-cabecalho">
        <h2>Usuários</h2>
        <span className="ml-auto text-[12px] text-texto-2">
          {usuarios.length === 1 ? '1 usuário' : `${usuarios.length} usuários`}
        </span>
      </div>

      <div className="px-[18px] py-1.5">
        {usuarios.map((usuario) => (
          <LinhaDeUsuarioNaLista
            key={usuario.id}
            usuario={usuario}
            souEu={usuario.id === idDoUsuarioAtual}
          />
        ))}
      </div>
    </div>
  )
}
