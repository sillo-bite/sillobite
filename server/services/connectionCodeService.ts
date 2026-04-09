import { db as getDb } from '../db';
import crypto from 'crypto';

const db = getDb();

interface ConnectionCode {
  id: string;
  userId: number;
  code: string;
  expiresAt: Date;
  isUsed: boolean;
  createdAt: Date;
}

interface ApiToken {
  id: string;
  userId: number;
  token: string;
  createdAt: Date;
}

const genCode = (len: number = 6): string => {
  const ch = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let cd = '';
  for (let i = 0; i < len; i++) {
    cd += ch[Math.floor(Math.random() * ch.length)];
  }
  return cd;
};

const genToken = (): string => {
  return crypto.randomBytes(32).toString('hex');
};

export const connectionCodeService = {
  async createCode(uid: number): Promise<{ code: string; expiresAt: Date }> {
    const exp = new Date(Date.now() + 2 * 60 * 1000);
    
    await db.$executeRaw`
      UPDATE connection_codes 
      SET is_used = true 
      WHERE user_id = ${uid} AND is_used = false
    `;

    let cd: string;
    let exists = true;
    
    while (exists) {
      cd = genCode(6);
      const chk = await db.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*) as count FROM connection_codes WHERE code = ${cd}
      `;
      exists = Number(chk[0].count) > 0;
    }

    await db.$executeRaw`
      INSERT INTO connection_codes (user_id, code, expires_at)
      VALUES (${uid}, ${cd!}, ${exp})
    `;

    return { code: cd!, expiresAt: exp };
  },

  async verifyCode(em: string, cd: string): Promise<{ token: string; userId: number } | null> {
    const usr = await db.user.findUnique({ where: { email: em } });
    if (!usr) return null;

    const cc = await db.$queryRaw<Array<ConnectionCode>>`
      SELECT id::text as id, user_id as "userId", code, expires_at as "expiresAt", is_used as "isUsed", created_at as "createdAt"
      FROM connection_codes 
      WHERE user_id = ${usr.id} AND code = ${cd} AND is_used = false
      LIMIT 1
    `;

    if (cc.length === 0) return null;

    const ccd = cc[0];
    if (new Date() > new Date(ccd.expiresAt)) return null;

    await db.$executeRawUnsafe(`
      UPDATE connection_codes 
      SET is_used = true 
      WHERE id = '${ccd.id}'::uuid
    `);

    const tk = genToken();

    // UPSERT: Update existing token or insert new one
    await db.$executeRawUnsafe(`
      INSERT INTO api_tokens (user_id, token, created_at)
      VALUES (${usr.id}, '${tk}', NOW())
      ON CONFLICT (user_id) 
      DO UPDATE SET token = '${tk}', created_at = NOW()
    `);

    return { token: tk, userId: usr.id };
  },

  async cleanExpired(): Promise<void> {
    await db.$executeRaw`
      DELETE FROM connection_codes 
      WHERE expires_at < NOW() AND is_used = false
    `;
  },

  async validateToken(tk: string): Promise<number | null> {
    const res = await db.$queryRaw<Array<ApiToken>>`
      SELECT * FROM api_tokens WHERE token = ${tk} LIMIT 1
    `;
    return res.length > 0 ? res[0].userId : null;
  }
};
