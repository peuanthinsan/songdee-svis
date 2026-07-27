# Software Requirement Specification
**Project Name:** Songdee Vehicle Inspection System (SVIS)

### **1. Objective**
To provide a multi-company digital solution for recording and monitoring **Daily Vehicle Inspections**. The system ensures that every vehicle in the fleet is checked for safety before operation, provides real-time visibility of pending tasks per fleet, and tracks the repair lifecycle when defects are found. DHL Express is the first and default company.

---

### **2. Data Structure (Core Tables)**
* **`Companies`**: Stores customer companies and their display configuration.
* **`User_Settings`**: Stores User Profiles (Username, Password, Company, Role, and **Assigned Fleet**).
* **`Vehicle_Master`**: Master list of all vehicles (Plate Number, Fleet Category, Fleet Manager Email).
    * Constraint: Read-Only for general users to prevent unauthorized vehicle entries.
* **`Inspection_Logs`**: Stores daily check data (Date, Vehicle ID, Inspector Name, Status: Pass/Fail, Defect Photos).
* **`Issue_Reports`**: Tracks repairs (Issue ID, Linked Inspection ID, Repair Status, Before/After Photos).

---

### **3. Key Business Logic (The "Heart" of the App)**
1.  **Daily Reset Status:** The system must calculate the inspection status **daily**.
    * **Checked (Green):** Vehicle ID exists in Inspection_Logs for **Today's Date**.
    * **Pending (Red):** Vehicle ID does not exist in Inspection_Logs for **Today's Date**.
2.  **Role-Based Access Control (RBAC):**
    * **Supervisor Level:** Can only see vehicles and data belonging to their **Assigned Fleet** (implement via Row-Level Security / Security Filters).
    * **Admin Level:** Full access to view and filter data across all fleets in their company.
    * **Tenant Boundary:** Every authenticated API request is restricted to the company stored in the signed session.
3.  **Authentication:** Users select their company, log in via **Username**, and can **Change Password** within their own profile. DHL is selected by default.

---

### **4. System Workflow**
1.  **Inspection Phase:** * Drivers select a vehicle from a pre-defined list (Manual entry is disabled).
    * If any check item is marked as **"Fail"**, the system must **force a photo upload** (Mandatory).
2.  **Automation & Alert:** * Upon saving a "Fail" result, an **automated email** is triggered to the respective **Fleet Manager**.
    * Content must include: Vehicle ID, Inspector Name, and attached Defect Photos.
3.  **Repair Phase (The Issue Loop):**
    * A "Fail" inspection automatically generates a new entry in the Issue_Reports table.
4.  **Closure (Proof of Safety):** * To close an issue, the mechanic must update the status to **"Completed"** and **must upload a "Completion Photo"** as proof of repair.

---

### **5. Dashboard & UI Requirements**
* **Operation Dashboard (Real-time):**
    * **Pie Chart:** Summary of % Completion for **Today** (Checked vs. Pending).
    * **Pending List:** Grouped by **Fleet** with a count of remaining vehicles (e.g., *BKK_Hub (5)*).
* **Historical Reports:**
    * Ability to filter and view data by **Day / Week / Month**.
    * Comparison View: Display **"Before Repair"** and **"After Repair"** photos side-by-side.
* **Branding:** Use the **SVIS** platform identity. Company identity is shown as workspace context without replacing the SVIS product brand.

---

### **6. Technical Constraints**
* **Platform:** AppSheet (or preferred Mobile/Web framework).
* **Security:** Enforce "Required Authentication" (Sign-in always required).
* **Audit Trail:** Automatically log Timestamp and User Email for every entry or update.

---

### **Deliverables for the Development Team:**
1.  Functional Login/Authentication system with Fleet-specific filtering.
2.  Dynamic Daily Inspection Form with mandatory photo logic.
3.  Automated Email Notification Engine.
4.  Real-time Management Dashboard with Historical Analytics and Before/After Repair tracking.
