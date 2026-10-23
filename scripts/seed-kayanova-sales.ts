import { createClient } from "@libsql/client"
import dotenv from "dotenv"
import path from "path"
import crypto from "crypto"

dotenv.config({ path: ".env.local" })

const tursoUrl = process.env.TURSO_DATABASE_URL
const tursoAuthToken = process.env.TURSO_AUTH_TOKEN

const localDbPath = path.join(process.cwd(), "prisma", "dev.db").replace(/\\/g, "/")
const localDb = createClient({ url: `file:${localDbPath}` })
const tursoDb = tursoUrl ? createClient({ url: tursoUrl, authToken: tursoAuthToken }) : null

function cuid() {
  return "c" + crypto.randomBytes(12).toString("hex")
}

async function executeBoth(sql: string, args: any[] = []) {
  await localDb.execute({ sql, args })
  if (tursoDb) {
    await tursoDb.execute({ sql, args })
  }
}

async function main() {
  console.log("Creating Kayanova Sales project and tasks...")

  // 1. Delete existing Kayanova Sales project if any to avoid duplication
  const checkRes = await localDb.execute("SELECT id FROM Project WHERE name LIKE '%Sales%'")
  for (const row of checkRes.rows) {
    const pId = String(row.id)
    console.log(`Cleaning old sales project ${pId}...`)
    await executeBoth("DELETE FROM Task WHERE projectId = ?", [pId])
    await executeBoth("DELETE FROM Milestone WHERE projectId = ?", [pId])
    await executeBoth("DELETE FROM Project WHERE id = ?", [pId])
  }

  // 2. Create Project
  const projectId = cuid()
  const now = new Date().toISOString()
  await executeBoth(
    `INSERT INTO Project (id, name, description, status, priority, isFocus, color, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      projectId,
      "Sales",
      "B2B medical clinic acquisition, automated n8n follow-ups, and market sector validation sprint.",
      "Active",
      "P1",
      1, // isFocus = true
      "#6366f1", // Indigo
      now,
      now,
    ]
  )
  console.log("Created Project: Sales (ID:", projectId, ")")

  // 3. Define Milestones
  const milestones = [
    {
      id: cuid(),
      title: "1. Lead Automation & Tooling (n8n)",
      description: "Automated WhatsApp sequences, lead owner reminders, and daily digest.",
      order: 1,
      dueDate: "2026-10-22T23:59:59.000Z",
    },
    {
      id: cuid(),
      title: "2. Weekly Solo Outreach & Sector Rotation",
      description: "5 new clinics online + 2 external industry validation contacts per week.",
      order: 2,
      dueDate: "2026-10-31T23:59:59.000Z",
    },
    {
      id: cuid(),
      title: "3. Hot Deals & Closing Sprint",
      description: "Priority high-stakes deals: Kassem, Hafez, Wells Dental, and Mohamed El-Shater.",
      order: 3,
      dueDate: "2026-10-28T23:59:59.000Z",
    },
    {
      id: cuid(),
      title: "4. Victoria & Loran Pipeline (with Youssef)",
      description: "Warm & Cold medical clinic pipeline in Victoria / El-Galaa and Loran.",
      order: 4,
      dueDate: "2026-10-28T23:59:59.000Z",
    },
    {
      id: cuid(),
      title: "5. Mahatet El-Raml Pipeline (with Mo'men)",
      description: "Warm & Cold clinic & lab accounts in Mahatet El-Raml.",
      order: 5,
      dueDate: "2026-10-28T23:59:59.000Z",
    },
  ]

  for (const m of milestones) {
    await executeBoth(
      `INSERT INTO Milestone (id, title, description, status, dueDate, projectId, "order", createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [m.id, m.title, m.description, "Active", m.dueDate, projectId, m.order, now, now]
    )
    console.log(`Created Milestone: ${m.title}`)
  }

  // 4. Define Tasks
  const tasks = [
    // Milestone 1: Lead Automation & Tooling (n8n)
    {
      milestoneId: milestones[0].id,
      title: "[TECH-01] Build & Deploy n8n Follow-up Machine",
      description: "Set up automated lead tracking with Lead IDs, WhatsApp sequence on Day 0 (intro & video), Day 3 (friction check), Day 7 (trial offer), lead owner reminder triggers, and morning daily digest of stalled leads.",
      priority: "Critical",
      dueDate: "2026-10-22T18:00:00.000Z",
      scheduledDate: "2026-10-22T00:00:00.000Z",
      status: "Todo",
      tags: JSON.stringify(["n8n", "automation", "tech", "infrastructure"]),
    },

    // Milestone 2: Weekly Solo Outreach & Sector Rotation
    {
      milestoneId: milestones[1].id,
      title: "[OUTREACH-01] Weekly Outreach: Contact 5 New Clinics Online",
      description: "Outreach to 5 new clinics via social media (Instagram, Facebook, WhatsApp). Approved hook: 'We help clinics acquire more patients and eliminate front-desk booking bottlenecks. May I send a 1-minute video showing how?' Goal: 1 demo/discovery call.",
      priority: "High",
      dueDate: "2026-10-24T23:59:59.000Z",
      scheduledDate: "2026-10-24T00:00:00.000Z",
      status: "Todo",
      tags: JSON.stringify(["solo", "outreach", "clinics", "weekly-quota"]),
    },
    {
      milestoneId: milestones[1].id,
      title: "[SECTOR-01] Sector Rotation Week 1: Educational Centers & Language Academies (2 Contacts)",
      description: "Contact 2 educational centers or language institutes. Angle: automated student inquiry handling, WhatsApp seat reservation, and tuition reminders. Track responses in Online Outreach log.",
      priority: "Medium",
      dueDate: "2026-10-24T23:59:59.000Z",
      scheduledDate: "2026-10-24T00:00:00.000Z",
      status: "Todo",
      tags: JSON.stringify(["solo", "sector-rotation", "education"]),
    },
    {
      milestoneId: milestones[1].id,
      title: "[SECTOR-02] Sector Rotation Week 2: Restaurants & Cafes Reservation Systems (2 Contacts)",
      description: "Contact 2 restaurants or cafes. Angle: table reservation automation, peak-hour rush management, menu delivery over WhatsApp. Validate customer interest.",
      priority: "Medium",
      dueDate: "2026-10-31T23:59:59.000Z",
      scheduledDate: null,
      status: "Todo",
      tags: JSON.stringify(["solo", "sector-rotation", "f&b"]),
    },

    // Milestone 3: Hot Deals & Closing Sprint
    {
      milestoneId: milestones[2].id,
      title: "[KN-010] Kassem Dental Center: Deliver Offline Desktop + Maintenance Proposal",
      description: "Owner explicitly requested offline desktop setup + monthly maintenance contract to reduce patient wait times. Gohar (Lead): Confirm device count, prepare 1-page written price proposal from Pricing Sheet, present offer for sign-off/trial, request 3 peer referrals, and lead closing follow-up.",
      priority: "Critical",
      dueDate: "2026-10-25T18:00:00.000Z",
      scheduledDate: "2026-10-22T00:00:00.000Z",
      status: "Todo",
      tags: JSON.stringify(["hot", "gohar-lead", "kassem", "closing"]),
    },
    {
      milestoneId: milestones[2].id,
      title: "[KN-026] Dr. Hafez Abdel Halim: Conduct 15-min Discovery & Submit Offer",
      description: "Gohar (Lead): Review previous meeting outcome with Youssef, obtain personal phone number, conduct 15-min discovery session on clinic friction points, and deliver tailored offer (Pilot Marketing or Trial System) within 24h.",
      priority: "Critical",
      dueDate: "2026-10-23T18:00:00.000Z",
      scheduledDate: "2026-10-20T00:00:00.000Z",
      status: "Todo",
      tags: JSON.stringify(["hot", "gohar-lead", "hafez", "closing"]),
    },
    {
      milestoneId: milestones[2].id,
      title: "[KN-027] Wells Dental: Attend 60-Day Media Buying Pilot Meeting & 48h Follow-up",
      description: "Primary: Youssef | Support: Gohar. Dr. Hazem wants patient volume (CPA KPI) with transparent weekly reporting. Gohar attends high-level decision meeting, then conducts 48h follow-up phone call to log outcome and close before Oct 28.",
      priority: "High",
      dueDate: "2026-10-28T18:00:00.000Z",
      scheduledDate: "2026-10-21T00:00:00.000Z",
      status: "Todo",
      tags: JSON.stringify(["hot", "gohar-support", "wells", "closing"]),
    },
    {
      milestoneId: milestones[2].id,
      title: "[KN-049] Mohamed El-Shater (4 Clinics): Attend Multi-Branch Pilot Meeting & Close",
      description: "Primary: Mo'men | Support: Gohar. Largest enterprise deal volume (4 clinics). Competitors pitched him. Joint discovery call to identify competitor pricing, offer single-clinic trial pilot + multi-branch discount on proven performance. Gohar leads 48h follow-up to close before Oct 28.",
      priority: "High",
      dueDate: "2026-10-28T18:00:00.000Z",
      scheduledDate: "2026-10-21T00:00:00.000Z",
      status: "Todo",
      tags: JSON.stringify(["hot", "gohar-support", "el-shater", "closing"]),
    },

    // Milestone 4: Victoria & Loran Pipeline (with Youssef)
    {
      milestoneId: milestones[3].id,
      title: "[KN-025] Dr. Ahmed Abdel Moneim: Send System vs Excel Comparison via WhatsApp",
      description: "Primary: Youssef | Support: Gohar. Send WhatsApp breakdown comparing automated clinic system against Excel spreadsheet chaos + propose 3 meeting slots.",
      priority: "Medium",
      dueDate: "2026-10-21T18:00:00.000Z",
      scheduledDate: "2026-10-21T00:00:00.000Z",
      status: "Todo",
      tags: JSON.stringify(["warm", "gohar-support", "youssef"]),
    },
    {
      milestoneId: milestones[3].id,
      title: "[KN-033] Petamo Clinic: Deliver Receptionist Workload ROI Pitch",
      description: "Primary: Gohar | Support: Youssef. Deliver ROI workload pitch: 'One smart bot offsets workload of a full-time receptionist'. Request direct session with clinic director.",
      priority: "Medium",
      dueDate: "2026-10-22T18:00:00.000Z",
      scheduledDate: "2026-10-22T00:00:00.000Z",
      status: "Todo",
      tags: JSON.stringify(["warm", "gohar-lead", "youssef"]),
    },
    {
      milestoneId: milestones[3].id,
      title: "[KN-028] Dr. Hamada Deyab: Request Direct Line & Pitch Social Media Booking",
      description: "Primary: Youssef | Support: Gohar. Request doctor's direct phone number; pivot pitch to social media revival + automated WhatsApp booking.",
      priority: "Medium",
      dueDate: "2026-10-22T18:00:00.000Z",
      scheduledDate: "2026-10-22T00:00:00.000Z",
      status: "Todo",
      tags: JSON.stringify(["warm", "gohar-support", "youssef"]),
    },
    {
      milestoneId: milestones[3].id,
      title: "[KN-030] Loran Physical Therapy: Enroll in n8n WhatsApp Sequence",
      description: "Primary: Gohar | Support: Youssef. Enroll into automated WhatsApp cadence (Day 0 intro & video, Day 3 pain question, Day 7 trial offer).",
      priority: "Low",
      dueDate: "2026-10-24T18:00:00.000Z",
      scheduledDate: "2026-10-24T00:00:00.000Z",
      status: "Todo",
      tags: JSON.stringify(["cold", "gohar-lead", "youssef", "n8n"]),
    },
    {
      milestoneId: milestones[3].id,
      title: "[KN-002] Diamond Clinics: Send Referral Intro Message",
      description: "Primary: Youssef | Support: Gohar. Send personalized referral intro message referencing mutual contact + schedule demo call after first case study.",
      priority: "Low",
      dueDate: "2026-10-25T18:00:00.000Z",
      scheduledDate: null,
      status: "Todo",
      tags: JSON.stringify(["cold", "gohar-support", "youssef"]),
    },
    {
      milestoneId: milestones[3].id,
      title: "[KN-003] Dr. Mohamed Ezzat: Send Referral Intro Message",
      description: "Primary: Gohar | Support: Youssef. Send personalized referral intro message + schedule demo call following first case study.",
      priority: "Low",
      dueDate: "2026-10-25T18:00:00.000Z",
      scheduledDate: null,
      status: "Todo",
      tags: JSON.stringify(["cold", "gohar-lead", "youssef"]),
    },
    {
      milestoneId: milestones[3].id,
      title: "[KN-004] Dr. Wael Hamdy: Send Referral Intro Message",
      description: "Primary: Youssef | Support: Gohar. Send personalized referral intro message + schedule demo call after first case study.",
      priority: "Low",
      dueDate: "2026-10-25T18:00:00.000Z",
      scheduledDate: null,
      status: "Todo",
      tags: JSON.stringify(["cold", "gohar-support", "youssef"]),
    },
    {
      milestoneId: milestones[3].id,
      title: "[KN-005] Dr. Tamer El-Shafei: Send Referral Intro Message",
      description: "Primary: Gohar | Support: Youssef. Send personalized referral intro message + schedule demo call after first case study.",
      priority: "Low",
      dueDate: "2026-10-25T18:00:00.000Z",
      scheduledDate: null,
      status: "Todo",
      tags: JSON.stringify(["cold", "gohar-lead", "youssef"]),
    },
    {
      milestoneId: milestones[3].id,
      title: "[KN-034] Dr. Yehia Zakaria: Direct Qualification Phone Call",
      description: "Primary: Youssef | Support: Gohar. Single direct telephone qualification call to the doctor; discontinue if no response.",
      priority: "Low",
      dueDate: "2026-10-25T18:00:00.000Z",
      scheduledDate: null,
      status: "Todo",
      tags: JSON.stringify(["cold", "gohar-support", "youssef"]),
    },
    {
      milestoneId: milestones[3].id,
      title: "[KN-031] 3D Dental: Archive Account (Closed - Lost)",
      description: "Primary: Gohar | Support: Youssef. Doctor explicitly declined meeting. Tagged as Closed - Lost, outreach discontinued.",
      priority: "Low",
      dueDate: null,
      scheduledDate: null,
      status: "Cancelled",
      tags: JSON.stringify(["dead", "gohar-lead", "youssef"]),
    },

    // Milestone 5: Mahatet El-Raml Pipeline (with Mo'men)
    {
      milestoneId: milestones[4].id,
      title: "[KN-046] My Hope Clinic: Conduct Pain Discovery Call on Booking Bottlenecks",
      description: "Primary: Gohar | Support: Mo'men. Discovery call: 'What frustrates you most about your current patient booking system?' Lock in consultation.",
      priority: "Medium",
      dueDate: "2026-10-21T18:00:00.000Z",
      scheduledDate: "2026-10-21T00:00:00.000Z",
      status: "Todo",
      tags: JSON.stringify(["warm", "gohar-lead", "momen"]),
    },
    {
      milestoneId: milestones[4].id,
      title: "[KN-048] El-Farouk Clinics: Pitch Marketing + Clinic System Hybrid to Mr. Hazem",
      description: "Primary: Gohar | Support: Mo'men. Contact Mr. Hazem pitching the combined package (Patient Acquisition Marketing + Reception Workflow System).",
      priority: "Medium",
      dueDate: "2026-10-21T18:00:00.000Z",
      scheduledDate: "2026-10-21T00:00:00.000Z",
      status: "Todo",
      tags: JSON.stringify(["warm", "gohar-lead", "momen"]),
    },
    {
      milestoneId: milestones[4].id,
      title: "[KN-051] Royal Lab: Digital Doctor Outreach to Cairo Marketing Director",
      description: "Primary: Mo'men | Support: Gohar. Account-based outreach to Cairo Marketing Director via LinkedIn/email; coordinate follow-up with Alex branch.",
      priority: "Medium",
      dueDate: "2026-10-22T18:00:00.000Z",
      scheduledDate: "2026-10-22T00:00:00.000Z",
      status: "Todo",
      tags: JSON.stringify(["warm", "gohar-support", "momen"]),
    },
    {
      milestoneId: milestones[4].id,
      title: "[KN-047] Dr. Ahmed Abdel Hamid: Enroll in n8n WhatsApp Sequence",
      description: "Primary: Mo'men | Support: Gohar. Enroll lead into automated n8n WhatsApp nurture workflow (Day 0, 3, 7).",
      priority: "Low",
      dueDate: "2026-10-24T18:00:00.000Z",
      scheduledDate: "2026-10-24T00:00:00.000Z",
      status: "Todo",
      tags: JSON.stringify(["cold", "gohar-support", "momen", "n8n"]),
    },
    {
      milestoneId: milestones[4].id,
      title: "[KN-029] Nouvelage: Account-Based LinkedIn & Email Outreach to Marketing Director",
      description: "Primary: Gohar | Support: Mo'men. Account-based B2B outreach via LinkedIn connection + email to Marketing Director.",
      priority: "Low",
      dueDate: "2026-10-26T18:00:00.000Z",
      scheduledDate: null,
      status: "Todo",
      tags: JSON.stringify(["cold", "gohar-lead", "momen"]),
    },
    {
      milestoneId: milestones[4].id,
      title: "[KN-052] Marzouk Labs: Remote Corporate Outreach to Operations Director",
      description: "Primary: Mo'men | Support: Gohar. Remote corporate outreach via LinkedIn + email + call to Operations/Marketing Director (no field visits).",
      priority: "Low",
      dueDate: "2026-10-25T18:00:00.000Z",
      scheduledDate: null,
      status: "Todo",
      tags: JSON.stringify(["cold", "gohar-support", "momen"]),
    },
    {
      milestoneId: milestones[4].id,
      title: "[KN-054] Seha Plus Lab: Remote LinkedIn & Email Outreach on WhatsApp Report Delivery",
      description: "Primary: Gohar | Support: Mo'men. Targeted LinkedIn & email outreach to Clinic Operations Director on WhatsApp lab report automation.",
      priority: "Low",
      dueDate: "2026-10-25T18:00:00.000Z",
      scheduledDate: null,
      status: "Todo",
      tags: JSON.stringify(["cold", "gohar-lead", "momen"]),
    },
    {
      milestoneId: milestones[4].id,
      title: "[KN-053] Dr. Amin Hassan El-Maghraby: Enroll in n8n WhatsApp Sequence",
      description: "Primary: Mo'men | Support: Gohar. Enroll into automated n8n WhatsApp sequence.",
      priority: "Low",
      dueDate: "2026-10-24T18:00:00.000Z",
      scheduledDate: "2026-10-24T00:00:00.000Z",
      status: "Todo",
      tags: JSON.stringify(["cold", "gohar-support", "momen", "n8n"]),
    },
    {
      milestoneId: milestones[4].id,
      title: "[KN-032] Dr. Ahmed El-Sayed Clinic: Enroll in n8n WhatsApp Sequence",
      description: "Primary: Gohar | Support: Mo'men. Enroll into automated n8n WhatsApp sequence.",
      priority: "Low",
      dueDate: "2026-10-24T18:00:00.000Z",
      scheduledDate: "2026-10-24T00:00:00.000Z",
      status: "Todo",
      tags: JSON.stringify(["cold", "gohar-lead", "momen", "n8n"]),
    },
    {
      milestoneId: milestones[4].id,
      title: "[KN-009] Jamela Clinic: Archive Account (90-Day Hold for AI Assistant Pitch)",
      description: "Primary: Mo'men | Support: Gohar. On-hold for 90 days; re-approach with AI Call-Center Assistant pitch.",
      priority: "Low",
      dueDate: null,
      scheduledDate: null,
      status: "Cancelled",
      tags: JSON.stringify(["dead", "gohar-support", "momen"]),
    },
  ]

  for (const t of tasks) {
    const taskId = cuid()
    await executeBoth(
      `INSERT INTO Task (id, title, description, status, priority, projectId, milestoneId, dueDate, scheduledDate, tags, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        taskId,
        t.title,
        t.description,
        t.status,
        t.priority,
        projectId,
        t.milestoneId,
        t.dueDate,
        t.scheduledDate,
        t.tags,
        now,
        now,
      ]
    )
    console.log(`Created Task: ${t.title}`)
  }

  console.log(`\nSuccessfully created project 'Sales' with ${milestones.length} milestones and ${tasks.length} tasks!`)
  process.exit(0)
}

main().catch((e) => {
  console.error("Error creating sales project:", e)
  process.exit(1)
})
