import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import MapWithImage from "./MapWithImage";

import "leaflet/dist/leaflet.css";
import "leaflet-draw/dist/leaflet.draw.css";
import "./index.css";

const root = createRoot(document.getElementById("root"));

root.render(
  <BrowserRouter>
    <Routes>
      {/* Пользовательский режим */}
      <Route path="/" element={<MapWithImage mode="user" />} />

      {/* Админский режим */}
      <Route path="/admin" element={<MapWithImage mode="admin" />} />

      {/* На всякий случай редирект всего остального на / */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  </BrowserRouter>
);
