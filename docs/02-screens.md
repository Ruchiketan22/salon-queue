# Screens & Features

General rules for every screen
- Language toggle (EN | ગુજ) in the header of every screen.
- Loading state: gold skeleton cards. Error state: friendly message with a [Retry] button.
- Staff screens (/reception, /barber/:name, /admin) ask for a PIN first (see docs/03-flows-rules.md). /display needs no PIN.

---

## Screen 1: Home (/)
User: customer on phone. Goal: see how busy the salon is and join.
- Top: salon name + logo, badge "Open · Closes 9 PM" (or "Closed")
- Live card: "6 people waiting · about 50 min"
- Barber chips with status: Ravi (Busy) · Amit (Free) · Imran (On break)
- Big gold button [ Join Queue ]
- If the online queue is closed: button disabled, message "Online queue is closed. Walk-ins are welcome at the salon."
- If nobody is waiting: "No one waiting, walk right in!"

## Screen 2: Join Queue (/join)
- Fields: Name (required), Phone (exactly 10 digits, validated with inline error)
- Service cards, multi-select, max 3: Haircut 30 min ₹150 · Beard trim 15 min ₹80 · Hair spa 45 min ₹400 · Head massage 20 min ₹120 · Facial 40 min ₹350 (EN + GU names). Off services are hidden.
- Selecting a 4th service shows "You can choose up to 3 services"
- Barber picker: "Any barber (fastest)" or a barber photo card; barbers on break show an "On break" tag but stay selectable
- Live summary bar: "Total 45 min · ₹230 · Expected wait ~35 min", updates as selections change
- [ Confirm ] disabled until name, valid phone and at least 1 service are set. On success go to My Status.
- If this phone already has an active spot: skip creating a new one and show a message "You are already in the queue" with a link to that spot.

## Screen 3: My Status (/status/:id)
- Large token "S-14" and position "4th in line"
- Circular countdown "about 35 min", updates by itself
- Chosen barber and services listed under the token
- When 2nd in line: banner "Start coming to the salon"
- If chosen barber is on break: notice "Ravi is on break" (wait time still shown)
- When called: full-screen gold "It's your turn! Go to Ravi", gentle pulse, phone vibration
- When In chair: "Enjoy your service" calm screen
- When Done: thank-you screen with [ Back to home ]
- When No-show: message "You were marked absent. Please rejoin the queue." with [ Join again ]
- [ Cancel my spot ] only while Waiting, with a confirmation pop-up

## Screen 4: Reception Dashboard (/reception) — tablet, landscape
- Top bar: [ + Add walk-in ] (quick form: name, phone, services, barber), queue count, language toggle
- Left (about 40%): one card per barber showing status (Free / Busy / On break), current customer, time left, and [ Call next ] (enabled only when that barber is free)
- Right (about 60%): waiting list in order, each row: token, name, services, preferred barber, waiting time, [ No-show ] (only on Called rows) and [ Cancel ]
- Rows waiting more than 60 minutes are highlighted amber
- Called rows show a 10-minute countdown; at 0 the [ No-show ] button turns red
- Empty state: "No one waiting"

## Screen 5: Barber View (/barber/:name) — phone
- Header: barber name and photo; toggle On break / Available
- Current customer card: name, services, timer since start
- Big buttons: [ Start ] (when a customer is Called for this barber) then [ Done ]
- "Next for you: S-15 Kunal (Haircut)" preview
- If no one is assigned: "No customer yet. Reception will call the next one."

## Screen 6: Waiting Area TV (/display) — 1920×1080
- Dark background, no navigation, readable from 5 metres
- One row per barber: photo, name, "Now: S-12" (or "Free" / "On break")
- "Up next" list of 5 tokens with estimated times
- A newly-called token flashes gold with a chime for 5 seconds
- Shows salon name, clock, and the Open/Closed badge

## Screen 7: Owner Settings (/admin)
- Services table: name (EN and GU), minutes, price, on/off, [ Edit ], [ + Add service ]
- Barbers on duty today (toggle per barber)
- Queue switch: Open / Closed for online joining
- Today's stats cards: customers served, average wait, no-shows
- Turning a service off hides it from /join immediately

## Sketches
Optional photos of hand-drawn layouts go in docs/sketches/ and are referenced by screen number.
