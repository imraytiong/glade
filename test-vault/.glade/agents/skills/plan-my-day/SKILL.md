---
name: Plan My Day
description: Reviews previous notes, calendar, and inbox to generate a
  structured daily plan.
---

# Instructions
Your objective is to help the user start their day by creating a comprehensive and actionable daily plan. You will synthesize information from three key sources: the previous day's daily note, the user's email inbox, and today's calendar. The final output is a new, structured markdown file for the current day.

### Step 1: Review Yesterday's Daily Note
1.  Locate the user's directory for daily notes.
2.  Find the note for the previous day. The file is likely named using a `YYYY-MM-DD.md` format.
3.  Scan the note for any unfinished tasks, open loops, or items marked for follow-up. These are often in sections like "To-Do," "Open Items," or at the end of the note.
4.  Copy these carry-over items into a temporary scratchpad.

### Step 2: Process Email Inbox (Achieve "Inbox Zero")
The goal here is not just to read emails, but to process them into actionable tasks, leaving a clean inbox.
1.  Access the user's primary email inbox.
2.  Iterate through each unread email and apply the following logic:
    *   **Delete/Archive:** If the email is not actionable and not required for reference (e.g., spam, notifications, newsletters), delete or archive it immediately.
    *   **Quick Reply:** If the email can be fully addressed with a reply that takes less than 2 minutes, reply and then archive it.
    *   **Convert to Task:** If the email requires significant work, extract the core action item. Create a new task in your scratchpad, noting the required action and any relevant context or links from the email. Then, archive the email.
    *   **Reference:** If the email contains information to be saved for later but has no immediate action (e.g., a receipt, an article), archive it or move it to a reference folder.
3.  By the end of this process, the inbox should be empty or contain only emails that have been intentionally left for review.

### Step 3: Review Today's Calendar
1.  Access the user's calendar for the current day.
2.  List all scheduled events, meetings, and appointments from the start to the end of the day.
3.  For each event, note the start time, end time, and title.
4.  Identify any necessary preparation. For example, if there's a meeting titled "Project Neptune Sync," add a task to your scratchpad: "Prepare for Project Neptune Sync."

### Step 4: Synthesize and Generate Today's Daily Note
Now, combine all the information you've gathered into a single, structured markdown file.
1.  Create a new file named with today's date (e.g., `YYYY-MM-DD.md`).
2.  Use the following template to structure the note. Populate it with the items from your scratchpad.

```markdown
# Daily Note: {{today's date}}

## ☀️ Top 3 Priorities
*   [ ] 1. [Agent should predict the most important task]
*   [ ] 2. [Agent should predict the second most important task]
*   [ ] 3. [Agent should predict the third most important task]

---

## 🗓️ Agenda & Schedule

**Morning (9am - 12pm)**
*   **09:00 - 09:30:** Daily Stand-up Meeting
*   **09:30 - 10:30:** [Slot in a high-priority task from inbox or yesterday]
*   **10:30 - 11:00:** [Slot in another task]
*   **11:00 - 12:00:** Project Neptune Sync

**Afternoon (1pm - 5pm)**
*   **1:00 - 2:30:** [Slot in a focused work block for a priority task]
*   **2:30 - 3:00:** Team Check-in
*   **3:00 - 4:30:** [Slot in tasks from inbox]
*   **4:30 - 5:00:** Daily Wrap-up & Plan for tomorrow

---

## ✅ Task List

### Carry-over from Yesterday
- [ ] [Task from yesterday's note]
- [ ] [Another task from yesterday's note]

### New from Inbox
- [ ] [Task extracted from email 1]
- [ ] [Task extracted from email 2]

### Meeting Prep
- [ ] [Preparation task for a meeting today]

---

## 📝 Notes
[Leave this section empty for the user to fill out during the day]

```

### Final Output
Present the complete, populated markdown file to the user. The goal is to provide a clear, actionable plan that the user can immediately begin to execute.