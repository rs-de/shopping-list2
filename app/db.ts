import { PrismaClient } from "./generated/prisma/index.js"

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const db = globalForPrisma.prisma ?? new PrismaClient()

globalForPrisma.prisma = db
