function m(t,a){if(t.length===0)return;const e=Object.keys(t[0]),c="\uFEFF"+[e.join(";"),...t.map(i=>e.map(l=>{const d=i[l],r=d==null?"":String(d);return r.includes(";")||r.includes('"')||r.includes(`
`)?`"${r.replace(/"/g,'""')}"`:r}).join(";"))].join(`
`),n=new Blob([c],{type:"text/csv;charset=utf-8;"});p(n,`${a}.csv`)}function u(t,a,e){if(t.length===0)return;const o=Object.keys(t[0]),c=`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${e}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
        h1 { font-size: 18px; margin-bottom: 5px; }
        .meta { font-size: 12px; color: #666; margin-bottom: 20px; }
        table { width: 100%; border-collapse: collapse; font-size: 11px; }
        th { background: #f0f0f0; padding: 8px 6px; text-align: left; border: 1px solid #ddd; font-weight: 600; }
        td { padding: 6px; border: 1px solid #ddd; }
        tr:nth-child(even) { background: #fafafa; }
        .footer { margin-top: 20px; font-size: 10px; color: #999; text-align: center; }
      </style>
    </head>
    <body>
      <h1>${e}</h1>
      <div class="meta">Esportato il ${new Date().toLocaleDateString("it-IT",{day:"numeric",month:"long",year:"numeric",hour:"2-digit",minute:"2-digit"})} · ${t.length} record</div>
      <table>
        <thead>
          <tr>${o.map(i=>`<th>${s(i)}</th>`).join("")}</tr>
        </thead>
        <tbody>
          ${t.map(i=>`
            <tr>${o.map(l=>`<td>${i[l]??""}</td>`).join("")}</tr>
          `).join("")}
        </tbody>
      </table>
      <div class="footer">Generato da ClerkAI</div>
    </body>
    </html>
  `,n=window.open("","_blank");n&&(n.document.write(c),n.document.close(),setTimeout(()=>{n.print()},500))}function s(t){return{name:"Nome",phone_e164:"Telefono",email:"Email",stage:"Fase",source:"Fonte",created_at:"Data Creazione",last_activity_at:"Ultima Attività",direction:"Direzione",duration:"Durata",outcome:"Esito",contact_name:"Contatto",status:"Stato",template:"Template",channel:"Canale",start_at:"Data Appuntamento",action:"Azione"}[t]||t.replace(/_/g," ").replace(/\b\w/g,e=>e.toUpperCase())}function p(t,a){const e=URL.createObjectURL(t),o=document.createElement("a");o.href=e,o.download=a,document.body.appendChild(o),o.click(),document.body.removeChild(o),URL.revokeObjectURL(e)}export{u as a,m as e};
