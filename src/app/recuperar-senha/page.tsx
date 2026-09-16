import type { Metadata } from 'next'
import { Marca } from '@/componentes/marca'
import { FormularioDeRecuperacao } from './formulario'

export const metadata: Metadata = {
  title: 'Recuperar senha — E. Ferreira Advogados',
}

/**
 * "Esqueci minha senha" da equipe (operador e administrador). Mesmo layout de
 * `/entrar`, porque é a mesma audiência — o cliente não tem senha para
 * esquecer, ver o comentário em `src/lib/redefinicao-de-senha.ts`.
 */
export default function PaginaDeRecuperacao() {
  return (
    <main className="grid min-h-screen grid-cols-1 lg:grid-cols-[1.05fr_0.95fr]">
      <section className="flex flex-col justify-between bg-grafite-800 px-6 py-8 lg:px-[42px] lg:py-11">
        <Marca />

        <p className="max-w-[19em] font-serif text-[21px] font-medium leading-[1.32] text-[#E9E9E9] lg:text-[27px]">
          Esqueceu a senha? Um código novo resolve.
        </p>

        <p className="text-[11.5px] leading-relaxed text-[#75757C]">
          Acesso restrito à equipe do escritório.
          <br />
          Todo pedido de redefinição é registrado.
        </p>
      </section>

      <section className="flex flex-col justify-center bg-superficie px-6 py-8 lg:px-[42px] lg:py-11">
        <h1 className="mb-1.5 font-serif text-[25px] font-semibold">
          Recuperar senha
        </h1>
        <p className="mb-7 text-[13px] text-texto-2">
          Informe o e-mail do seu acesso. Enviaremos um código para redefinir a
          senha.
        </p>

        <FormularioDeRecuperacao />

        <p className="mt-3.5 text-center text-[11.5px] text-texto-3">
          <a href="/entrar" className="underline underline-offset-2">
            Voltar para entrar no painel
          </a>
        </p>
      </section>
    </main>
  )
}
