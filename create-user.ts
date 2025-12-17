import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function createUser() {
  try {
    const user = await prisma.user.create({
      data: {
        email: 'dinez.production@gmail.com',
        name: 'dinez',
        role: 'admin',
        isProfileComplete: true
      }
    });
    console.log('✅ User created successfully:', user);
  } catch (error) {
    if (error.code === 'P2002') {
      console.log('ℹ️ User already exists');
    } else {
      console.error('❌ Error creating user:', error);
    }
  } finally {
    await prisma.$disconnect();
  }
}

createUser();
