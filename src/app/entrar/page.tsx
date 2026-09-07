import type { Metadata } from 'next'
import { Marca } from '@/componentes/marca'
import { FormularioDeEntrada } from './formulario'

export const metadata: Metadata = {
  title: 'Entrar no painel — E. Ferreira Advogados',
}

/**
 * Tela "Entrar — operador" do protótipo aprovado: arte à esquerda sobre
 * grafite, formulário à direita sobre a superfície branca.
 */
export default function PaginaDeEntrada() {
  return (
    <main className="grid min-h-screen grid-cols-1 lg:grid-cols-[1.05fr_0.95fr]">
      <section className="flex flex-col justify-between bg-grafite-800 px-6 py-8 lg:px-[42px] lg:py-11">
        <Marca />

        <p className="max-w-[19em] font-serif text-[21px] font-medium leading-[1.32] text-[#E9E9E9] lg:text-[27px]">
          Cada processo em um lugar só, com o histórico de quem fez o quê.
        </p>

        <p className="text-[11.5px] leading-relaxed text-[#75757C]">
          Acesso restrito à equipe do escritório.
          <br />
          Todo acesso é registrado. Tráfego criptografado, conforme a Cláusula 5ª.
        </p>
      </section>

      <section className="flex flex-col justify-center bg-superficie px-6 py-8 lg:px-[42px] lg:py-11">
        <h1 className="mb-1.5 font-serif text-[25px] font-semibold">
          Entrar no painel
        </h1>
        <p className="mb-7 text-[13px] text-texto-2">
          Use o e-mail individual fornecido pelo escritório.
        </p>

        <FormularioDeEntrada />

        <p className="mt-3.5 text-center text-[11.5px] text-texto-3">
          Esqueceu a senha? Fale com o administrador do escritório.
        </p>

        <div className="mt-7 border-t border-borda pt-[18px]">
          <div className="aviso aviso-atencao">
            <span aria-hidden="true">▲</span>
            <div>
              Após 5 tentativas erradas, o acesso é bloqueado por 15 minutos. É a
              proteção mínima para um painel que guarda dado de processo.
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
