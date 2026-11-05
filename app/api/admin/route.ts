import { errorResponse, isAdmin, requireUser } from "../_lib/appwrite";

export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    return Response.json({ isAdmin: isAdmin(user.$id) });
  } catch (error) {
    return errorResponse(error, 401);
  }
}
