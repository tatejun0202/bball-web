// src/app/result-spot/[id]/page.tsx
import ResultSpotClient from './result-spot-client'

export default async function ResultSpotPage(
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const idNum = Number(id)

  if (!Number.isFinite(idNum)) {
    return <main style={{ padding: 16 }}>invalid id</main>
  }
  return <ResultSpotClient sessionId={idNum} />
}