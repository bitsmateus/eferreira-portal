/**
 * Do JSON da requisição para a forma que os validadores do sistema esperam.
 *
 * Ficam aqui, e não na rota, por duas razões. A primeira é técnica: arquivo de
 * rota do Next só pode exportar verbo HTTP. A segunda é melhor: `POST` e `PUT`
 * de cliente precisam do MESMO mapeamento, e mapeamento duplicado é onde os
 * dois começam a discordar sobre o que é um cadastro.
 *
 * Os validadores são os mesmos do painel — `validarCliente`, `validarCaso`,
 * `validarAndamento`. Se a API tivesse regra própria, um dia aceitaria um
 * cadastro que a tela recusa, e o sistema passaria a ter duas opiniões sobre o
 * que é válido.
 */

import { comoTexto } from '@/lib/api'
import type { CamposDeCaso } from '@/lib/casos'
import type { CamposDeAndamento } from '@/lib/andamentos'
import type { CamposDeCliente } from '@/lib/clientes'

export function camposDeClienteDoCorpo(
  corpo: Record<string, unknown>,
): CamposDeCliente {
  return {
    documento: comoTexto(corpo['documento']),
    nome: comoTexto(corpo['nome']),
    rg: comoTexto(corpo['rg']),
    dataNascimento: comoTexto(corpo['dataNascimento']),
    estadoCivil: comoTexto(corpo['estadoCivil']),
    profissao: comoTexto(corpo['profissao']),
    nacionalidade: comoTexto(corpo['nacionalidade']),
    nomeMae: comoTexto(corpo['nomeMae']),
    email: comoTexto(corpo['email']),
    telefone: comoTexto(corpo['telefone']),
    cep: comoTexto(corpo['cep']),
    endereco: comoTexto(corpo['endereco']),
  }
}

/**
 * Honorários entram vazios de propósito: são a cláusula de pagamento do
 * contrato, digitada no painel junto com o documento que vai ser assinado.
 * Ver a nota da regra 12 em `src/app/api/v1/casos/route.ts`.
 */
export function camposDeCasoDoCorpo(corpo: Record<string, unknown>): CamposDeCaso {
  return {
    honorarios: '',
    numeroProcesso: comoTexto(corpo['numeroProcesso']),
    assunto: comoTexto(corpo['assunto']),
    vara: comoTexto(corpo['vara']),
    parteContraria: comoTexto(corpo['parteContraria']),
    situacao: comoTexto(corpo['situacao']),
    responsavelId: comoTexto(corpo['responsavelId']),
  }
}

export function camposDeAndamentoDoCorpo(
  corpo: Record<string, unknown>,
): CamposDeAndamento {
  return {
    data: comoTexto(corpo['data']),
    statusId: comoTexto(corpo['statusId']),
    descricao: comoTexto(corpo['descricao']),
  }
}
