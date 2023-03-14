export const id = "index";

export async function Component() {
	await new Promise((resolve) => setTimeout(resolve, 200));
	return (
		<main>
			<h1>Home</h1>
			<a href="/about">About</a>
		</main>
	);
}
