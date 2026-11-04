# 02 - Users and Permissions

Only **two levels** (decided in the meeting): Admin and Master.

## Roles

### Admin
- Anas. Possibly his wife for the ladies' line (**open question**).
- Signs in with a single password (ADMIN_PASSWORD env var) and a signed cookie (small built-in login, not Auth.js; chosen with the user).
- Full control of everything.

### Master
- 2-4 head karigars, each in a different office. The master is on Anas's payroll; the master's own workers are not modelled.
- **No login, no username.** Access is via:
  - a personal, unguessable **URL token** that Admin generates and shares once (usually on WhatsApp), and
  - a short personal **code / PIN** that Admin sets, so a stray link-clicker cannot interfere. Numbers and letters are allowed (Anas's example: `1234A`).
- Masters never select who they are from a dropdown. Admin picks the master, and the link is tied to that master.
- Masters never see other masters' links or data (different factories, confidential).
- The master is told to check the link every day for new orders.

## Permission table

| Action | Admin | Master |
|---|---|---|
| Create / edit orders | Yes | No |
| See "My due date" | Yes | **No** |
| See "Karigar due date" | Yes | Yes |
| Assign an order to a master | Yes | No |
| Reorder priority | Yes | **No** |
| Create / edit templates, categories, fields | Yes | No |
| View orders | All | Only assigned to them |
| See whether a master has opened an order | Yes | No |
| View order details and measurements | Yes | Yes (read-only) |
| Upload photos | Yes (reference pictures) | Yes (stage photos), only where allowed |
| Approve / reject photos, comment | Yes | No (sees the result and comments) |
| Mark a stage complete | Yes | Yes, where unlocked |
| Print / export order sheets | Yes | Yes |
| Shipping checklist and bill upload | View | Yes |
| Cancel order | Yes | No |
| Archive order | Yes | No |
| Hard delete | Later, Admin only | Never |
| Create master links / PINs | Yes | No |

## Access-control notes
- Security is deliberately light ("not a highly secure environment"), but still:
  - Use long random tokens (nanoid) in links.
  - Hash PINs and rate-limit wrong attempts.
  - Photo files must not be publicly guessable: check the token before serving an image.
- A master who guesses another token is out of scope but should still see nothing beyond that token's own data.
