import ResultClient from './result-client'

// ★ async にして、params を await
export default async function ResultPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const idNum = Number(id)
  if (!Number.isFinite(idNum)) {
    return <div style={{ padding: 16 }}>invalid id</div>
  }
  return <ResultClient sessionId={idNum} />
}
