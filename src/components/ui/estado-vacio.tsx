// Componente compartido para estados vacios (sin datos, sin resultados de
// busqueda/filtro, etc). Antes vivia duplicado dentro de src/app/page.tsx;
// se extrae aca para que cualquier vista (dashboard, tabla de pedidos, etc)
// use siempre el mismo look: icono + texto animado, en vez de mezclar texto
// plano en unos lados e icono en otros.
export function EstadoVacio({ icon: Icon, texto }: { icon: React.ComponentType<{ className?: string }>; texto: string }) {
  return (
    <div className="animate-in-soft flex flex-col items-center gap-3 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary/70">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <p className="text-sm text-muted-foreground">{texto}</p>
    </div>
  );
}
