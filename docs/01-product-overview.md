# 01 - Product Overview

## The problem
Anas runs a custom-clothing business. Orders are made in Pakistan (Karachi area) by a chain of craftsmen and shipped abroad. Today:

- He creates an order form (customer name, due date, design number, fabric, colour, embroidery notes, kurta, pants, shoes, shawl, free notes, reference pictures, full measurements). Each order takes **30-40 minutes** to enter.
- The form is sent to the master as a **PDF over WhatsApp**. The master prints it at a local internet cafe (about 10 rupees per page) and attaches it to the roll of fabric, where it travels with the garment through every station.
- Masters ignore the intended sequence and do the most **lucrative** work first. Example: an order due in two months is finished while 20 earlier orders are untouched. Anas must then send priority lists on WhatsApp and phone the masters.
- Every Monday Anas spends about **3 hours** reconciling around 22 papers and delivery dates.
- Embroidery quality is checked over video call. Masters forget to send photos, and wrong garments have been made.
- Shipments have arrived abroad **missing items** (for example, the pants), and re-shipping costs about $100.

## The goal
One simple tool where:
1. Anas enters each custom order once, using pre-built templates.
2. Anas controls the **priority sequence**, and masters must follow it.
3. Masters see only their assigned orders, upload photos, tick stages, and print.
4. Anas approves photos before the next stage unlocks.
5. Shipping cannot be submitted until a checklist is complete and the bill is uploaded.

## Workflow being digitised (per garment)
Cutting master (measure, fabric, lining, steaming, rough outline, cut, about 3-4 hours up to 3-4 days) -> Embroidery karigar (5-15 days; **photo required**) -> back to cutting master for stitching -> Checker (measurements, finishing) -> Packing -> Accountant (invoice) -> Shipping company -> confirmation to Anas.

Stages must be **configurable**, not hard-coded.

## Who uses it
- **Anas (Admin):** desktop or phone, comfortable with English.
- **Masters (2-4):** head karigars in different offices/factories, each on a cheap Android phone (some iPhone) with Chrome and WhatsApp only. They have roughly 5th-6th grade education. Each master manages sub-workers on their own payroll; the app only knows the master.
- Anas's wife manages the ladies' line (see open questions for account handling).

## Success looks like
- The Monday 3-hour priority session drops to minutes.
- No master works out of sequence without Anas knowing.
- No garment advances past a photo-gated stage without approval.
- No shipment leaves with a missing item or without a bill.

## Scale
- About 20+ orders per month, 2-4 masters, 5-10 categories (not hundreds).
- Photos about 300 per month after compression.

## Non-goals
- Not a general task manager (Monday, Trello and similar were considered and rejected: they are not per-customer, per-item, and not suitable for low-literacy users).
- No native mobile app (PWA only).
- No heavy security or full user management. A personal link plus PIN is enough.
- No hard delete in the first versions.
- Not for ready-made/stock products. **Custom orders only.**
- Not multi-language (English only).
- Not a public website; no customer-facing access.

## Delivery constraint
Anas will not give masters a half-finished product: they have no bandwidth to test. He will test it himself first, with the developers acting as his "colleague". Aim for something **lightweight**, not months of work.
