"use client";

import { FileDown } from "lucide-react";
import Button from "./Button";

export default function ExportPdfButton({ label = "Export PDF" }: { label?: string }) {
  const handleExport = () => {
    window.print();
  };

  return (
    <Button variant="outline" size="sm" onClick={handleExport} icon={<FileDown size={14} />}>
      {label}
    </Button>
  );
}
