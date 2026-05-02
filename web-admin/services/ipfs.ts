const PINATA_JWT = process.env.NEXT_PUBLIC_PINATA_JWT ?? ''
const PINATA_GATEWAY = 'https://gateway.pinata.cloud/ipfs'

export async function uploadToIPFS(file: File): Promise<string> {
  if (!PINATA_JWT) throw new Error('NEXT_PUBLIC_PINATA_JWT no configurado')

  const form = new FormData()
  form.append('file', file)

  const res = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
    method: 'POST',
    headers: { Authorization: `Bearer ${PINATA_JWT}` },
    body: form,
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Error Pinata: ${res.status} ${text}`)
  }

  const data = await res.json()
  return data.IpfsHash as string
}

export function ipfsToUrl(hash: string): string {
  if (!hash) return ''
  if (hash.startsWith('http')) return hash
  return `${PINATA_GATEWAY}/${hash}`
}
