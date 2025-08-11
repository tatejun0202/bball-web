// src/app/result/[id]/page.tsx
import ResultClient from './result-client'

export default async function ResultPage(
  { params }: { params: Promise<{ id: string }> } // ★ Promise で受ける
) {
  const { id } = await params                          // ★ await が必須
  const idNum = Number(id)

  if (!Number.isFinite(idNum)) {
    return <main style={{ padding: 16 }}>invalid id</main>
  }
  return <ResultClient sessionId={idNum} />
}
