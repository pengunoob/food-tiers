"use client";

import { FormEvent, useState } from "react";

type Restaurant = { id: string; name: string; neighborhood: string; city: string; cuisine: string; categories: string[]; averagePrice: number | null; voteCount: number; scoreTotal: number };
type Props = { restaurants: Restaurant[]; authHeaders: () => Promise<Record<string, string>>; onChanged: () => Promise<void> };

export default function AdminPanel({ restaurants, authHeaders, onChanged }: Props) {
  const [editing, setEditing] = useState<Restaurant | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    const body = { name: String(fields.get("name") ?? ""), city: String(fields.get("city") ?? ""), neighborhood: String(fields.get("neighborhood") ?? ""), cuisine: String(fields.get("cuisine") ?? ""), categories: String(fields.get("categories") ?? ""), averagePrice: String(fields.get("averagePrice") ?? "") };
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/restaurants", { method: editing ? "PATCH" : "POST", headers: await authHeaders(), body: JSON.stringify(editing ? { ...body, restaurantId: editing.id } : body) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Restaurant could not be saved.");
      const successMessage = editing ? "Restaurant updated." : "Restaurant added to the board.";
      await onChanged(); setEditing(null); form.reset(); setMessage(successMessage);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Restaurant could not be saved."); } finally { setBusy(false); }
  }

  async function archive() {
    if (!editing) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/restaurants?restaurantId=${encodeURIComponent(editing.id)}`, { method: "DELETE", headers: await authHeaders() });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Restaurant could not be archived.");
      await onChanged(); setEditing(null); setMessage("Restaurant removed from the public board.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Restaurant could not be archived."); } finally { setBusy(false); }
  }

  return <>
    <p className="section-kicker">ADMINISTRATION</p><h2>Manage restaurants.</h2><p className="modal-copy">Add a new place, set its categories and price, correct its details, or archive it from the public tier list. Votes remain intact when a restaurant is archived.</p>
    <form className="admin-form" key={editing?.id ?? "new"} onSubmit={save}>
      <div className="admin-form-heading"><div><span>{editing ? "Editing restaurant" : "New restaurant"}</span><strong>{editing?.name ?? "Add a place to the board"}</strong></div>{editing && <button type="button" className="admin-reset" onClick={() => { setEditing(null); setMessage(""); }}>New entry</button>}</div>
      <input name="name" required maxLength={120} defaultValue={editing?.name} placeholder="Restaurant name" />
      <div className="admin-grid"><input name="cuisine" required maxLength={100} defaultValue={editing?.cuisine} placeholder="Cuisine" /><input name="neighborhood" required maxLength={100} defaultValue={editing?.neighborhood} placeholder="Neighborhood" /></div>
      <input name="city" required maxLength={100} defaultValue={editing?.city} placeholder="City" />
      <input name="categories" maxLength={400} defaultValue={editing?.categories.join(", ")} placeholder="Categories (comma-separated, e.g. date night, late night)" />
      <label className="price-field"><span>Average price</span><select name="averagePrice" defaultValue={editing?.averagePrice ?? ""}><option value="">Not set</option>{[1, 2, 3, 4, 5].map((price) => <option key={price} value={price}>{"$".repeat(price)}</option>)}</select></label>
      <button className="primary-button" disabled={busy}>{busy ? "Saving..." : editing ? "Save changes" : "Add restaurant"}<span>→</span></button>
    </form>
    {editing && <button className="remove-vote" onClick={archive} disabled={busy}>Archive {editing.name}</button>}
    {message && <p className={message.includes("could not") || message.includes("required") ? "form-error" : "admin-success"}>{message}</p>}
    <div className="admin-list"><p className="admin-list-label">ACTIVE RESTAURANTS · {restaurants.length}</p>{restaurants.map((restaurant) => <button key={restaurant.id} className={`admin-row ${editing?.id === restaurant.id ? "selected" : ""}`} onClick={() => { setEditing(restaurant); setMessage(""); }}><span><strong>{restaurant.name}</strong><small>{restaurant.cuisine} · {restaurant.neighborhood}{restaurant.averagePrice ? ` · ${"$".repeat(restaurant.averagePrice)}` : ""}</small></span><em>Edit →</em></button>)}</div>
  </>;
}
