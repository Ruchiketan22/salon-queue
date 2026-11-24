# Flows & Rules

## Flow: remote customer
1. Customer opens Home, taps Join, picks Haircut + "Any barber", confirms and gets token S-14 (6th in line)
2. They watch My Status from home; at 2nd in line they see "Start coming to the salon"
3. Reception taps [ Call next ] on Amit's card, so S-14 becomes Called
4. Customer's phone shows "It's your turn! Go to Amit" and the TV flashes S-14
5. Amit taps [ Start ] (In chair), then [ Done ]. S-14 leaves the queue and stats update.

## Flow: walk-in
Reception taps [ + Add walk-in ], enters name, phone and services, and the customer joins the same queue at the end (first come, first served). Walk-ins can still be added after online joining closes.

## Flow: no-show
Customer is Called but doesn't arrive. After 10 minutes reception can mark No-show. If the customer arrives later, reception adds them again; they get a new token at the END of the queue.

## Rules
### Statuses
- Allowed moves: Waiting -> Called -> In chair -> Done. Waiting -> Cancelled. Called -> No-show.
- Never move backwards. The backend rejects any other move.
- Customers can cancel only while Waiting.

### Tokens
- Format S-1, S-2, ... Numbers restart at 1 every day.
- Re-added no-show customers get a new token.

### Choosing who is next
- First come, first served.
- [ Call next ] on barber X picks the earliest Waiting customer who chose X or "Any barber".
- A customer who chose Ravi is never given to another barber, even if others are free.
- A barber can only be called for when they are Available and have nobody Called or In chair.
- If nobody matches, [ Call next ] shows "No matching customer for this barber".

### Waiting time
- Estimated wait ≈ total minutes of services of everyone ahead of you ÷ number of barbers on duty and not on break, rounded up to the nearest 5 minutes.
- If there are 0 people ahead and a barber is free, wait is 0 ("You're next!").
- It is a rough estimate and recalculates whenever the queue changes.

### Joining
- One active spot per phone number. A second attempt shows the existing spot.
- Phone must be exactly 10 digits. 1 to 3 services per customer.
- Online joining closes 30 minutes before closing (8:30 PM), or when the owner switches it off. Walk-ins are still allowed.
- Services switched off by the owner cannot be chosen.

### Barbers
- Barber On break: customers who chose them see "Ravi is on break"; their current customer is not affected. Barbers on break cannot be called for.
- Barbers not on duty today are hidden from the picker and not counted in wait time.

### Staff access
- /reception, /barber/:name and /admin require a PIN (test PINs: reception 1111, barber 2222, admin 3333; replace if you change them and list them in README).

### Sync
- All screens update within 5 seconds without manual refresh (Socket.IO). If the connection drops, show "Reconnecting..." and recover automatically.

## Test checklist
[ ] Join with 2 services -> correct total time and price shown
[ ] Phone with fewer or more than 10 digits -> error, cannot confirm
[ ] Selecting a 4th service is blocked with a message
[ ] Same phone joins twice -> shown existing spot, no duplicate
[ ] Call next for Amit skips a customer who chose Ravi
[ ] Call next -> customer's phone shows "It's your turn" within 5 seconds
[ ] Start/Done on Barber View updates Reception and TV
[ ] No-show, then re-add -> goes to end of queue with a new token
[ ] Cancel works while Waiting and is not offered once Called
[ ] Invalid status move (e.g. Waiting -> Done) is rejected by the backend
[ ] Close online queue -> Join button disabled with message; walk-in still works
[ ] Service switched off in admin disappears from Join
[ ] Barber on break -> customers who chose them see the notice; Call next disabled
[ ] Language toggle switches all labels to Gujarati with no overflow
[ ] Waiting time goes down as customers finish
[ ] Phone, tablet and TV windows stay in sync; data survives a backend restart
