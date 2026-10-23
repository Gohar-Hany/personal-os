import { getProjects } from "@/lib/projects/projectService"
import { serialize } from "@/lib/utils"
import { ProjectsClient } from "@/components/projects/ProjectsClient"

export const dynamic = "force-dynamic"

export default async function ProjectsPage() {
  const projects = await getProjects()
  return <ProjectsClient projects={serialize(projects)} />
}
