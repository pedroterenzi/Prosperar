/** Geração de eventos de calendário (Google Agenda link + arquivo .ics). */

type CalEvent = {
  uid: string;
  title: string;
  details: string;
  location: string;
  startIso: string;
  endIso: string;
};

/** ISO → formato iCal em UTC: 20261023T143000Z */
const icsStamp = (iso: string) =>
  new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

/** Arquivo .ics com lembrete 2h antes (padrão do fluxo de cancelamento). */
export function buildIcs(e: CalEvent): string {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Prosperar Club//Agendamento//PT-BR',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${e.uid}@prosperar`,
    `DTSTAMP:${icsStamp(new Date().toISOString())}`,
    `DTSTART:${icsStamp(e.startIso)}`,
    `DTEND:${icsStamp(e.endIso)}`,
    `SUMMARY:${e.title}`,
    `DESCRIPTION:${e.details.replace(/\n/g, '\\n')}`,
    `LOCATION:${e.location}`,
    'BEGIN:VALARM',
    'TRIGGER:-PT2H',
    'ACTION:DISPLAY',
    'DESCRIPTION:Seu agendamento é em 2 horas',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

/** Link "Adicionar ao Google Agenda" (abre pronto para salvar). */
export function googleCalendarUrl(e: CalEvent): string {
  const q = new URLSearchParams({
    action: 'TEMPLATE',
    text: e.title,
    dates: `${icsStamp(e.startIso)}/${icsStamp(e.endIso)}`,
    details: e.details,
    location: e.location,
  });
  return `https://calendar.google.com/calendar/render?${q.toString()}`;
}

/** Download direto do .ics (Apple Calendar, Outlook, etc.). */
export function downloadIcs(filename: string, ics: string): void {
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
