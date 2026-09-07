import { describe, expect, it } from 'vitest'
import { TipoDocumento } from '@prisma/client'

import { validarAnexo, validarArquivo } from '@/lib/documentos'
import { TAMANHO_MAXIMO_BYTES, TIPOS_ACEITOS } from '@/lib/arquivos'
import { gerarChaveDeArquivo } from '@/lib/armazenamento'
import { formatarTamanho } from '@/lib/formatos'

/** `File` do runtime do Node 20+, que é o que a ação de servidor recebe. */
function arquivo(nome: string, tipo: string, bytes: number): File {
  return new File([new Uint8Array(bytes)], nome, { type: tipo })
}

describe('validarArquivo', () => {
  it('aceita PDF dentro do limite', () => {
    const resultado = validarArquivo(arquivo('contrato.pdf', 'application/pdf', 2048))

    expect(resultado.ok).toBe(true)
    if (!resultado.ok) return

    expect(resultado.dados.nome).toBe('contrato.pdf')
    expect(resultado.dados.tipoConteudo).toBe('application/pdf')
    expect(resultado.dados.tamanho).toBe(2048)
  })

  it('aceita imagem — o cliente manda foto do documento pelo celular', () => {
    for (const tipo of ['image/jpeg', 'image/png', 'image/heic']) {
      expect(validarArquivo(arquivo('rg.jpg', tipo, 1024)).ok).toBe(true)
    }
  })

  it('recusa arquivo ausente ou vazio', () => {
    expect(validarArquivo(null).ok).toBe(false)
    expect(validarArquivo(arquivo('vazio.pdf', 'application/pdf', 0)).ok).toBe(false)
  })

  // Lista fechada: o que não está no mapa não entra no balde.
  it('recusa tipo fora da lista, mesmo com extensão convincente', () => {
    const resultado = validarArquivo(
      arquivo('procuracao.pdf.exe', 'application/x-msdownload', 512),
    )

    expect(resultado.ok).toBe(false)
    if (resultado.ok) return

    expect(resultado.erros['arquivo']).toMatch(/não aceito/i)
  })

  it('recusa arquivo acima do limite', () => {
    const resultado = validarArquivo(
      arquivo('gigante.pdf', 'application/pdf', TAMANHO_MAXIMO_BYTES + 1),
    )

    expect(resultado.ok).toBe(false)
    if (resultado.ok) return

    expect(resultado.erros['arquivo']).toMatch(/limite/i)
  })

  it('aceita exatamente no limite', () => {
    expect(
      validarArquivo(arquivo('limite.pdf', 'application/pdf', TAMANHO_MAXIMO_BYTES)).ok,
    ).toBe(true)
  })

  it('inventa um nome quando o arquivo chega sem nome', () => {
    const resultado = validarArquivo(arquivo('   ', 'application/pdf', 128))

    expect(resultado.ok).toBe(true)
    if (!resultado.ok) return

    expect(resultado.dados.nome).toBe('documento.pdf')
  })
})

describe('validarAnexo', () => {
  it('aceita tipo válido e caso em branco como documento do cliente', () => {
    const resultado = validarAnexo({ tipo: TipoDocumento.CONTRATO, casoId: '' })

    expect(resultado.ok).toBe(true)
    if (!resultado.ok) return

    expect(resultado.dados.tipo).toBe(TipoDocumento.CONTRATO)
    expect(resultado.dados.casoId).toBeNull()
  })

  it('recusa tipo fora do domínio, com mensagem em português', () => {
    const resultado = validarAnexo({ tipo: 'SENTENCA', casoId: '' })

    expect(resultado.ok).toBe(false)
    if (resultado.ok) return

    expect(resultado.erros['tipo']).toBe('Tipo de documento inválido.')
  })
})

describe('gerarChaveDeArquivo', () => {
  // Regra 5: não pode haver caminho adivinhável para um documento.
  it('não carrega nome, CPF nem id do cliente, e nunca se repete', () => {
    const chaves = new Set<string>()
    for (let i = 0; i < 500; i += 1) chaves.add(gerarChaveDeArquivo())

    expect(chaves.size).toBe(500)
    for (const chave of chaves) {
      expect(chave).toMatch(
        /^documentos\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      )
    }
  })
})

describe('TIPOS_ACEITOS', () => {
  it('mapeia todo tipo aceito para uma extensão', () => {
    for (const [tipo, extensao] of Object.entries(TIPOS_ACEITOS)) {
      expect(tipo).toMatch(/^[a-z]+\/[a-z0-9.+-]+$/)
      expect(extensao).toMatch(/^[a-z]+$/)
    }
  })
})

describe('formatarTamanho', () => {
  it('usa a unidade que cabe, com vírgula decimal', () => {
    expect(formatarTamanho(512)).toBe('512 B')
    expect(formatarTamanho(240 * 1024)).toBe('240 KB')
    expect(formatarTamanho(Math.round(1.4 * 1024 * 1024))).toBe('1,4 MB')
  })
})
