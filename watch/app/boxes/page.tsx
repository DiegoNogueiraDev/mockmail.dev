import EmailBoxesView from "@/components/EmailBoxesView";

export default function BoxesPage() {
  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Caixas Temporárias</h1>
        <p className="text-gray-600 mt-2">
          Visualize usuários e suas respectivas caixas de email temporárias
        </p>
      </div>
      <EmailBoxesView />
    </div>
  );
}
