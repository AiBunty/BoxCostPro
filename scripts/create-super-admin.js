/**
 * Create Initial Super Admin Account
 * This script creates the first super admin account for BoxCostPro
 * Email: aibuntysystems@gmail.com
 * Temporary Password: Admin@2026!Temp
 * 
 * IMPORTANT: Change password immediately after first login!
 */

import { db } from "../server/db.js";
import { admins } from "../shared/schema.js";
import bcrypt from "bcrypt";
import { eq } from "drizzle-orm";

const SUPER_ADMIN_EMAIL = "aibuntysystems@gmail.com";
const TEMP_PASSWORD = "Admin@2026!Temp";

async function createSuperAdmin() {
  try {
    console.log("🔧 Creating initial super admin account...");
    console.log(`📧 Email: ${SUPER_ADMIN_EMAIL}`);
    console.log(`🔑 Temporary Password: ${TEMP_PASSWORD}`);
    console.log("⚠️  CHANGE PASSWORD IMMEDIATELY AFTER FIRST LOGIN!\n");

    // Check if admin already exists
    const existing = await db.select().from(admins).where(eq(admins.email, SUPER_ADMIN_EMAIL));
    
    if (existing.length > 0) {
      console.log("ℹ️  Super admin already exists. Updating password...");
      
      const passwordHash = await bcrypt.hash(TEMP_PASSWORD, 10);
      await db.update(admins)
        .set({ 
          passwordHash,
          isActive: true,
          twofaEnabled: false,
          twofaSecretEncrypted: null,
          updatedAt: new Date()
        })
        .where(eq(admins.email, SUPER_ADMIN_EMAIL));
      
      console.log("✅ Super admin password reset successfully!");
    } else {
      console.log("Creating new super admin account...");
      
      const passwordHash = await bcrypt.hash(TEMP_PASSWORD, 10);
      await db.insert(admins).values({
        email: SUPER_ADMIN_EMAIL,
        passwordHash,
        role: "super_admin",
        displayName: "AI Bunty Systems",
        isActive: true,
        twofaEnabled: false,
        twofaSecretEncrypted: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      
      console.log("✅ Super admin account created successfully!");
    }

    console.log("\n📝 Login Instructions:");
    console.log("1. Go to: http://localhost:5000/admin.html");
    console.log(`2. Email: ${SUPER_ADMIN_EMAIL}`);
    console.log(`3. Password: ${TEMP_PASSWORD}`);
    console.log("4. CHANGE YOUR PASSWORD IMMEDIATELY!\n");
    
    process.exit(0);
  } catch (error) {
    console.error("❌ Error creating super admin:", error);
    process.exit(1);
  }
}

createSuperAdmin();
