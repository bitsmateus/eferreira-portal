import type { Metadata } from 'next'

import { BotaoFlutuanteDoWhatsapp } from '@/componentes/botao-flutuante-whatsapp'
import { Marca } from '@/componentes/marca'
import { ESCRITORIO, MENSAGEM_DE_SUPORTE_NO_WHATSAPP } from '@/lib/escritorio'
import { linkDoWhatsapp } from '@/lib/formatos'
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

        {/*
          O aviso explicando por que o código existe foi tirado da tela, a
          pedido do escritório (16/09/2026) — a explicação de segurança que
          interessa a quem desenvolve não precisa aparecer para o cliente que
          só quer consultar o processo. O motivo em si continua documentado
          aqui em cima e em docs/area-do-cliente.md.
        */}
        <p className="mt-4 text-center text-[11.5px] text-texto-3">
          Não conseguiu acessar ou não recebeu o código?{' '}
          <a
            href={linkDoWhatsapp(ESCRITORIO.whatsappDeSuporte, MENSAGEM_DE_SUPORTE_NO_WHATSAPP)}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2"
          >
            Fale conosco pelo WhatsApp
          </a>
        </p>

        <p className="mt-3.5 border-t border-borda pt-[18px] text-center text-[11.5px] text-texto-3">
          É da equipe do escritório?{' '}
          <a href="/entrar" className="underline underline-offset-2">
            Entrar no painel
          </a>
        </p>
      </section>

      <BotaoFlutuanteDoWhatsapp numero={ESCRITORIO.whatsappDeSuporte} />
    </main>
  )
}
