"use client";

import { ControllersCard } from "./components/controllers-card";
import { AutomationsCard } from "./components/automations-card";
import { AutomationForm } from "./components/automation-form";
import { DeliveriesCard } from "./components/deliveries-card";

export default function AutomationsPage() {
  return (
    <div className="flex flex-col h-full">
      <div className="-mt-[1px] -ml-[1px]">
        <ControllersCard />
      </div>
      <div className="-mt-[1px] -ml-[1px]">
        <AutomationsCard />
      </div>
      <div className="-mt-[1px] -ml-[1px]">
        <AutomationForm />
      </div>
      <div className="-mt-[1px] -ml-[1px]">
        <DeliveriesCard />
      </div>
    </div>
  );
}
