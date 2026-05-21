"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import DeveloperModal from "./Registration";
import DepartmentModal from "./Registration";
import ContractorModal from "./Registration";
import { CARD_HEADER_GRADIENT } from "@/app/utils/buttonClasses";
import { TEXT_BODY, TEXT_MUTED, TEXT_TITLE_CARD } from "@/app/utils/typography";

type Tile = {
  title: string;
  items: string[];
  /** @deprecated Headers use CARD_HEADER_GRADIENT; kept for data shape compatibility */
  color?: string;
};

type TileGridProps = {
  tiles: Tile[];
};

const MODAL_KEYS: Record<string, string> = {
  Developer: "Developer",
  Owner: "Owner",
  Department: "Department",
  "BMC Contractors": "Contractor",
};

const TileGrid = ({ tiles }: TileGridProps) => {
  const [activeModal, setActiveModal] = useState("");
  const router = useRouter();

  function onClick(item: string) {
    // Navigate to owner registration page
    if (item === "Owner") {
      router.push("/owner");
      return;
    }
    else if (item === "Consultant") {
      router.push("/consultant");
      return;
    }
    
    const modalKey = MODAL_KEYS[item];
    if (modalKey) setActiveModal(modalKey);
  }

  return (
    <>
      {/* TILE UI */}
      <section className="w-full bg-gray-100 py-6">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-4 px-4 md:grid-cols-5 md:px-6">
          {tiles.map((tile) => (
            <div
              key={tile.title}
              className="cursor-pointer overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition-all duration-300 hover:scale-[1.02] hover:shadow-md"
            >
              <div className={`px-4 py-3 ${CARD_HEADER_GRADIENT}`}>
                <h4 className={TEXT_TITLE_CARD}>{tile.title}</h4>
              </div>

              <ul className={`space-y-2 px-4 py-3 ${TEXT_BODY}`}>
                {tile.items.map((item) => (
                  <li
                    key={item}
                    onClick={() => onClick(item)}
                    className={`flex items-center gap-2 ${TEXT_MUTED} hover:text-emerald-700`}
                  >
                    <span className="text-emerald-500">»</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* MODALS */}
      <DeveloperModal
        open={activeModal === "Developer"}
        onClose={() => setActiveModal("")}
      />

      <DepartmentModal
        open={activeModal === "Department"}
        onClose={() => setActiveModal("")}
      />

      <ContractorModal
        open={activeModal === "Contractor"}
        onClose={() => setActiveModal("")}
      />
    </>
  );
};

export type { Tile };
export default TileGrid;
