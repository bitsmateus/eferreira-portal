import type { Metadata } from 'next'

import { Marca } from '@/componentes/marca'
import { FormularioDeConsulta } from './formulario'

export const metadata: Metadata = {
  title: 'Consultar meu processo — Portal do Cliente E. Ferreira',
}

/**
 * Tela "Cliente — entrar" do protótipo aprovado.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * UMA COISA DO PROTÓTIPO NÃO FOI SEGUIDA, DE PROPÓSITO
 *
 * O protótipo escreve, na segunda etapa: "Código enviado para
 * m•••••@email.com.br". Mostrar o e-mail — mesmo mascarado — só é possível
 * depois de encontrar o cliente, e portanto responde a quem digitou um CPF
 * qualquer se aquela pessoa é cliente deste escritório. A relação entre uma
 * pessoa e o advogado dela é justamente o tipo de informação que este portal
 * existe para proteger.
 *
 * Por isso a segunda etapa não mostra endereço nenhum, e a confirmação do
 * envio é escrita no condicional. Está registrado no CLAUDE.md: quando o
 * protótipo conflita com o escopo, o escopo vence e se avisa.
 * ─────────────────────────────────────────────────────────────────────────
 */
export default function PaginaDeConsulta() {
  return (
    <main className="grid min-h-screen grid-cols-1 lg:grid-cols-[1.05fr_0.95fr]">
      <section className="flex flex-col justify-between bg-grafite-800 px-6 py-8 lg:px-[42px] lg:py-11">
        <Marca />

        <p className="max-w-[19em] font-serif text-[21px] font-medium leading-[1.32] text-[#E9E9E9] lg:text-[27px]">
          Acompanhe seu processo a qualquer hora, sem precisar ligar.
        </p>

        <p className="text-[11.5px] leading-relaxed text-[#75757C]">
          Portal do Cliente · E. Ferreira Advogados
          <br />
          Seus dados são acessíveis apenas por você e pela equipe do escritório.
        </p>
      </section>

      <section className="flex flex-col justify-center bg-superficie px-6 py-8 lg:px-[42px] lg:py-11">
        <h1 className="mb-1.5 font-serif text-[25px] font-semibold">
          Consultar meu processo
        </h1>
        <p className="mb-7 text-[13px] text-texto-2">
          Informe o CPF ou CNPJ cadastrado. Enviaremos um código para o seu e-mail.
        </p>

        <FormularioDeConsulta />

        <div className="mt-7 border-t border-borda pt-[18px]">
          <div className="aviso aviso-info">
            <span aria-hidden="true">▲</span>
            <div>
              O código por e-mail existe por um motivo: sem ele, qualquer pessoa que
              saiba um CPF ou CNPJ veria o processo daquele cliente. Dado de
              processo é dado sensível de terceiro.
            </div>
          </div>
        </div>

        <p className="mt-5 text-center text-[11.5px] text-texto-3">
          É da equipe do escritório?{' '}
          <a href="/entrar" className="underline underline-offset-2">
            Entrar no painel
          </a>
        </p>
      </section>
    </main>
  )
}
