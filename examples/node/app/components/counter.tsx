"use client";
import * as React from "react";

export function Counter() {
	const [count, setCount] = React.useState(0);
	return (
		<p>
			<button onClick={() => setCount(count - 1)}>-</button>
			<span> {count} </span>
			<button onClick={() => setCount(count + 1)}>+</button>
		</p>
	);
}
