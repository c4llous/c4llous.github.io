// Vercel Function: POST /api/contact. Secrets come from the project's environment variables.
import { handleContact } from '../server/contact.js';

export function POST(request: Request) {
  return handleContact(request, process.env);
}
