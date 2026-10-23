/**
 * Seed script — populates the database with initial data from the spec.
 * Run with: npx tsx prisma/seed.ts
 */

/* eslint-disable @typescript-eslint/no-require-imports */
import { PrismaClient } from "@prisma/client"
import path from "path"

const { PrismaLibSql } = require("@prisma/adapter-libsql")

const dbPath = path.join(process.cwd(), "prisma", "dev.db").replace(/\\/g, "/")
const adapter = new PrismaLibSql({ url: `file:${dbPath}` })
const prisma = new PrismaClient({ adapter })


async function main() {
  console.log("🌱 Seeding Personal OS...")

  // ─── User Settings ───────────────────────────────────
  await prisma.userSettings.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      name: "Gohar",
      timezone: "Africa/Cairo",
      location: "Alexandria, Egypt",
      latitude: 31.2001,
      longitude: 29.9187,
      defaultCurrency: "EGP",
      charityPercentage: 5.0,
      theme: "dark",
      prayerMethod: "Egyptian",
    },
    update: {
      name: "Gohar",
      timezone: "Africa/Cairo",
      location: "Alexandria, Egypt",
      latitude: 31.2001,
      longitude: 29.9187,
      theme: "dark",
      prayerMethod: "Egyptian",
    },
  })


  // ─── Goals ───────────────────────────────────────────
  const goal1k = await prisma.goal.upsert({
    where: { id: "goal-savings-1k" },
    create: {
      id: "goal-savings-1k",
      name: "$1,000 Savings",
      category: "Financial",
      targetValue: 1000,
      currentValue: 0,
      unit: "USD",
      status: "Active",
      priority: "High",
    },
    update: {},
  })

  const goal10k = await prisma.goal.upsert({
    where: { id: "goal-savings-10k" },
    create: {
      id: "goal-savings-10k",
      name: "$10,000 Savings",
      category: "Financial",
      targetValue: 10000,
      currentValue: 0,
      unit: "USD",
      status: "Active",
      priority: "High",
    },
    update: {},
  })

  await prisma.goal.upsert({
    where: { id: "goal-car" },
    create: {
      id: "goal-car",
      name: "Car",
      description: "Future financial/lifestyle goal. Set target amount when ready.",
      category: "Financial",
      targetValue: null,
      currentValue: 0,
      status: "Active",
      priority: "Medium",
    },
    update: {},
  })

  await prisma.goal.upsert({
    where: { id: "goal-apartment" },
    create: {
      id: "goal-apartment",
      name: "Apartment",
      description: "Future financial/lifestyle goal. Set target amount when ready.",
      category: "Financial",
      targetValue: null,
      currentValue: 0,
      status: "Active",
      priority: "Medium",
    },
    update: {},
  })

  // ─── Projects ─────────────────────────────────────────
  const ldcProject = await prisma.project.upsert({
    where: { id: "proj-ldc" },
    create: {
      id: "proj-ldc",
      name: "LDC Internship",
      description: "AI and Machine Learning internship at Link Datacenter. Current focus: Learning LangGraph and contributing to the internship project.",
      status: "Active",
      priority: "P0",
      isFocus: true,
    },
    update: {},
  })

  const saudiProject = await prisma.project.upsert({
    where: { id: "proj-saudi" },
    create: {
      id: "proj-saudi",
      name: "Saudi Jobs Platform",
      description: "Primary personal development project during the internship period.",
      status: "Active",
      priority: "P1",
    },
    update: {},
  })

  await prisma.project.upsert({
    where: { id: "proj-botipia" },
    create: {
      id: "proj-botipia",
      name: "BOTIPIA",
      description: "Initial stage.",
      status: "Planned",
      priority: "P2",
    },
    update: {},
  })

  await prisma.project.upsert({
    where: { id: "proj-doctor-ai" },
    create: {
      id: "proj-doctor-ai",
      name: "Doctor AI Assistant",
      description: "Initial stage.",
      status: "Idea",
      priority: "P2",
    },
    update: {},
  })

  await prisma.project.upsert({
    where: { id: "proj-seeraty" },
    create: {
      id: "proj-seeraty",
      name: "Seeraty V2",
      description: "Low urgency.",
      status: "Paused",
      priority: "P3",
    },
    update: {},
  })

  await prisma.project.upsert({
    where: { id: "proj-raseen" },
    create: {
      id: "proj-raseen",
      name: "راسين في الحلال",
      description: "Backlog / low urgency initially.",
      status: "Idea",
      priority: "P3",
    },
    update: {},
  })

  // ─── Milestones for LDC ────────────────────────────────
  const milestones = [
    { id: "ms-ldc-1", title: "LangGraph Fundamentals", projectId: ldcProject.id, order: 0 },
    { id: "ms-ldc-2", title: "State & Nodes", projectId: ldcProject.id, order: 1 },
    { id: "ms-ldc-3", title: "Edges & Routing", projectId: ldcProject.id, order: 2 },
    { id: "ms-ldc-4", title: "Persistence & Checkpointing", projectId: ldcProject.id, order: 3 },
    { id: "ms-ldc-5", title: "Advanced Concepts", projectId: ldcProject.id, order: 4 },
    { id: "ms-ldc-6", title: "Project Implementation", projectId: ldcProject.id, order: 5 },
  ]

  for (const ms of milestones) {
    await prisma.milestone.upsert({
      where: { id: ms.id },
      create: ms,
      update: {},
    })
  }

  // ─── Habits / Religious Activities ────────────────────
  const habits = [
    {
      id: "habit-fajr",
      name: "Fajr",
      category: "Religious",
      recurrence: "daily",
      isPrayer: true,
      order: 0,
    },
    {
      id: "habit-dhuhr",
      name: "Dhuhr",
      category: "Religious",
      recurrence: "daily",
      isPrayer: true,
      order: 1,
    },
    {
      id: "habit-asr",
      name: "Asr",
      category: "Religious",
      recurrence: "daily",
      isPrayer: true,
      order: 2,
    },
    {
      id: "habit-maghrib",
      name: "Maghrib",
      category: "Religious",
      recurrence: "daily",
      isPrayer: true,
      order: 3,
    },
    {
      id: "habit-isha",
      name: "Isha",
      category: "Religious",
      recurrence: "daily",
      isPrayer: true,
      order: 4,
    },
    {
      id: "habit-quran",
      name: "Quran",
      category: "Religious",
      recurrence: "daily",
      targetValue: 2,
      unit: "pages",
      isQuran: true,
      order: 5,
    },
    {
      id: "habit-morning-adhkar",
      name: "Morning Adhkar",
      category: "Religious",
      recurrence: "daily",
      isAdhkar: true,
      order: 6,
    },
    {
      id: "habit-evening-adhkar",
      name: "Evening Adhkar",
      category: "Religious",
      recurrence: "daily",
      isAdhkar: true,
      order: 7,
    },
    {
      id: "habit-workout",
      name: "Workout",
      category: "Health",
      recurrence: "custom",
      weekdays: JSON.stringify([1, 3, 6]), // Mon, Wed, Sat
      targetValue: 30,
      unit: "minutes",
      order: 8,
    },
  ]

  for (const habit of habits) {
    await prisma.habit.upsert({
      where: { id: habit.id },
      // @ts-ignore — weekdays is optional
      create: habit,
      update: {},
    })
  }

  console.log("✅ Seed complete!")
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
