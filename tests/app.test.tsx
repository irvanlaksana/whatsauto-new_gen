// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import App from "../src/App";

/**
 * Smoke test UI: memastikan shell React benar-benar ter-render dan simulator
 * menjalankan engine (seed rule "menu") sampai balasan muncul di layar.
 */

afterEach(() => {
  cleanup();
  localStorage.clear();
});

beforeAll(() => {
  // jsdom tidak mengimplementasikan scrollIntoView.
  Element.prototype.scrollIntoView = () => undefined;
  localStorage.clear();
});

describe("App", () => {
  it("merender shell dan panel spreadsheet secara default", () => {
    render(<App />);
    expect(screen.getByText("WhatsAuto Sheet Sync")).toBeTruthy();
    expect(screen.getByText("Sumber spreadsheet")).toBeTruthy();
  });

  it("menjalankan simulator: pesan 'menu' dibalas aturan seed", async () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /Simulator/i }));
    await waitFor(() => expect(screen.getByText("Uji balasan")).toBeTruthy());

    const input = screen.getByPlaceholderText("Ketik pesan masuk…");
    const form = input.closest("form") as HTMLFormElement;
    // jsdom tidak mengirim event submit dari klik tombol, jadi submit formnya langsung.
    const send = (value: string) => {
      fireEvent.change(input, { target: { value } });
      fireEvent.submit(form);
    };

    // Pesan pertama -> pesan sambutan (langkah 9 di engine).
    send("boleh lihat menu?");
    await waitFor(
      () => expect(screen.getByText(/terima kasih sudah menghubungi kami/i)).toBeTruthy(),
      { timeout: 6000 },
    );

    // Pesan berikutnya dari nomor lain (menghindari cooldown) -> aturan seed "menu".
    fireEvent.change(screen.getByDisplayValue("+6281234567890"), {
      target: { value: "+628999000111" },
    });
    send("menu");
    await waitFor(
      () => expect(screen.getByText(/Ini daftar layanan kami/)).toBeTruthy(),
      { timeout: 6000 },
    );
    expect(screen.getByText(/Halo Budi Santoso!/)).toBeTruthy();
  }, 20000);
});
