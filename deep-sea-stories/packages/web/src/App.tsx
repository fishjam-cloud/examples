import angler from './assets/angler.webp';

function App() {
	return (
		<main className="flex h-screen w-screen flex-col items-center gap-8 px-4 pt-4 pb-4 md:px-6 md:pt-8 md:pb-16 xl:px-20">
			<img className="size-full object-contain" src={angler} alt="angler" />
		</main>
	);
}

export default App;
