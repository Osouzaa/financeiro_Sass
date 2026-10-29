/** DATE do SQL Server <-> 'YYYY-MM-DD' sem passar por fuso horário. */
export const toDbDate = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
export const fromDbDate = (date: Date) => date.toISOString().slice(0, 10);
