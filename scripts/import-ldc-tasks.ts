import { prisma } from "../src/lib/prisma"

async function main() {
  // 1. Find or create the LDC project
  let project = await prisma.project.findFirst({
    where: {
      OR: [
        { name: { contains: "LDC" } },
        { name: { contains: "ldc" } },
      ],
    },
    include: { milestones: true, tasks: true },
  })

  if (!project) {
    project = await prisma.project.create({
      data: {
        name: "LDC - Enterprise AI Support Agent",
        description: "Role-Based Enterprise AI Support Agent using LangGraph with RAG, RBAC, Database & Human-in-the-Loop workflows.",
        status: "Active",
        priority: "Critical",
        isFocus: true,
        category: "Work",
      },
      include: { milestones: true, tasks: true },
    })
    console.log("Created new LDC Project:", project.name)
  } else {
    // Update description and make it focus if needed
    project = await prisma.project.update({
      where: { id: project.id },
      data: {
        description: "Role-Based Enterprise AI Support Agent using LangGraph with RAG, RBAC, Database & Human-in-the-Loop workflows.",
        isFocus: true,
      },
      include: { milestones: true, tasks: true },
    })
    console.log("Found existing LDC Project:", project.name)
  }

  // 2. Create Milestone for Phase 1
  let phase1Milestone = await prisma.milestone.findFirst({
    where: {
      projectId: project.id,
      title: { contains: "Phase 1" },
    },
  })

  if (!phase1Milestone) {
    phase1Milestone = await prisma.milestone.create({
      data: {
        projectId: project.id,
        title: "Phase 1 — LangGraph Foundation & Intent Classification",
        description: "Build the basic LangGraph workflow, Agent State, Intent Classifier (7+ intents), Conditional Router, Unit Tests, and Docs.",
        order: 1,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      },
    })
    console.log("Created Milestone:", phase1Milestone.title)
  }

  // 3. Create Milestone for Phases 2-5 (Architecture Roadmap)
  let roadmapMilestone = await prisma.milestone.findFirst({
    where: {
      projectId: project.id,
      title: { contains: "Phases 2-5" },
    },
  })

  if (!roadmapMilestone) {
    roadmapMilestone = await prisma.milestone.create({
      data: {
        projectId: project.id,
        title: "Phases 2-5 — RAG, RBAC, HITL & REST API Deployment",
        description: "Enterprise features: Vector Knowledge Base, Role-Based Authorization, Human Approval, Checkpointers & FastAPI.",
        order: 2,
        dueDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000),
      },
    })
    console.log("Created Milestone:", roadmapMilestone.title)
  }

  // 4. Define all Phase 1 Tasks
  const tasksToCreate = [
    {
      title: "Setup Python Enterprise Project Structure & Dependencies",
      description: "Initialize Poetry/UV project with LangGraph, LangChain, Pydantic v2, FastAPI, and Pytest. Establish clean src/ architecture.",
      priority: "High",
      status: "Todo",
      milestoneId: phase1Milestone.id,
    },
    {
      title: "Define Agent Typed State Schema & Context Models",
      description: "Implement AgentState with MessagesState, user metadata (id, role: Customer/Support/Senior/Admin), detected intent, and routing flags.",
      priority: "Critical",
      status: "Todo",
      milestoneId: phase1Milestone.id,
    },
    {
      title: "Implement Structured Intent Classification Node (7+ Intents)",
      description: "Create intent classification node using structured outputs with at least 7 intents: technical_question, search_kb, check_tickets, create_ticket, update_ticket, sensitive_op, general_query.",
      priority: "Critical",
      status: "Todo",
      milestoneId: phase1Milestone.id,
    },
    {
      title: "Build Core LangGraph State Graph & Conditional Router",
      description: "Construct StateGraph workflow with Receive Message, Intent Classifier, Intent Router, and Response Nodes with conditional routing edges.",
      priority: "Critical",
      status: "Todo",
      milestoneId: phase1Milestone.id,
    },
    {
      title: "Implement Structured Logging & Graph Execution Tracing",
      description: "Add comprehensive logging for agent node transitions, state mutations, intent confidence, and error trapping.",
      priority: "Medium",
      status: "Todo",
      milestoneId: phase1Milestone.id,
    },
    {
      title: "Write Unit Tests for Intent Classification & Branch Routing",
      description: "Implement Pytest test suite covering all 7 intent branches, boundary cases, and state verification.",
      priority: "High",
      status: "Todo",
      milestoneId: phase1Milestone.id,
    },
    {
      title: "Draft Phase 1 Architecture Guide & README Documentation",
      description: "Document project setup, graph architecture diagram, intent taxonomy, and testing instructions in README.md.",
      priority: "Medium",
      status: "Todo",
      milestoneId: phase1Milestone.id,
    },
    // Roadmap Tasks
    {
      title: "Design RAG Knowledge Base & Support Ticket DB Schema (Phase 2)",
      description: "Architect SQLite/PostgreSQL relational schema for tickets and Chroma/FAISS vector store for technical documentation.",
      priority: "Medium",
      status: "Todo",
      milestoneId: roadmapMilestone.id,
    },
    {
      title: "Implement Role-Based Access Control (RBAC) Permission Matrix (Phase 3)",
      description: "Implement permission verification node matching roles (Customer, Support Agent, Senior Agent, Admin) against requested operations.",
      priority: "Medium",
      status: "Todo",
      milestoneId: roadmapMilestone.id,
    },
    {
      title: "Implement Human-in-the-Loop (HITL) Sensitive Action Approvals (Phase 4)",
      description: "Add LangGraph interrupt mechanisms for sensitive/destructive operations requiring senior agent or admin approval.",
      priority: "Low",
      status: "Todo",
      milestoneId: roadmapMilestone.id,
    },
    {
      title: "Build FastAPI REST API & LangGraph State Persistence Checkpointer (Phase 5)",
      description: "Expose LangGraph agent over FastAPI REST endpoints with authentication, streaming, and persistent conversation checkpointer.",
      priority: "Low",
      status: "Todo",
      milestoneId: roadmapMilestone.id,
    },
  ]

  // Insert tasks that don't already exist
  for (const t of tasksToCreate) {
    const exists = await prisma.task.findFirst({
      where: {
        projectId: project.id,
        title: t.title,
      },
    })

    if (!exists) {
      await prisma.task.create({
        data: {
          projectId: project.id,
          title: t.title,
          description: t.description,
          priority: t.priority,
          status: t.status,
          milestoneId: t.milestoneId,
        },
      })
      console.log(`Created Task: [${t.priority}] ${t.title}`)
    } else {
      console.log(`Task already exists: ${t.title}`)
    }
  }

  console.log("All LDC Project tasks successfully populated!")
}

main()
  .catch((e) => {
    console.error("Error creating tasks:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
