import { notFound } from "next/navigation"
import { getProject } from "@/lib/projects/projectService"
import { serialize } from "@/lib/utils"
import { ProjectDetailClient } from "@/components/projects/ProjectDetailClient"

export const dynamic = "force-dynamic"

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const project = await getProject(id)
  if (!project) notFound()
  return <ProjectDetailClient project={serialize(project)} />
}
