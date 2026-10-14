export class KpiCard {
     id: number;
     title: string;
     value: number;
     change: string;
     trend: "up" | "down" | "";
     period = "vs yesterday";

     constructor(id: number, title: string, today: number, yesterday: number) {
          this.id = id;
          this.title = title;
          this.value = today;

          if (yesterday === 0) {
               this.change = today > 0 ? "+100%" : "0%";
               this.trend = today > 0 ? "up" : "";
               return;
          }

          const percentage = ((today - yesterday) / yesterday) * 100;

          this.change = `${percentage >= 0 ? "+" : ""}${percentage.toFixed(1)}%`;
          this.trend = percentage > 0 ? "up" : percentage < 0 ? "down" : "";
     }
}
