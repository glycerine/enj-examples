package main

import (
	"github.com/ajhager/enj"
	"github.com/neelance/gopherjs/js"
	"math/rand"
)

var (
	app     *enj.App
	region  *enj.Region
	batch   *enj.Batch
	bots    []*Sprite
	stats   js.Object
	on      bool
	counter js.Object
	num     int
)

func init() {
	Stats := js.Global("Stats")
	if !Stats.IsUndefined() {
		stats = Stats.New()
		stats.Call("setMode", 0)
		element := stats.Get("domElement")
		element.Get("style").Set("position", "absolute")
		js.Global("document").Call("getElementById", "example").Call("appendChild", element)
	}

	counter = js.Global("document").Call("createElement", "div")
	counter.Set("id", "counter")
	js.Global("document").Call("getElementById", "example").Call("appendChild", counter)
	counter.Set("innerHTML", "TOUCH!")
}

type Sprite struct {
	X, Y   float32
	DX, DY float32
	Image  *enj.Region
}

type Botmark struct {
	*enj.Game
}

func (b *Botmark) Load() {
	app.Load.Image("../data/bot.png")
}

func (b *Botmark) Setup() {
	batch = app.NewBatch()
	region = app.NewTexture("../data/bot.png", false).Region(0, 0, 32, 32)
}

func (b *Botmark) Update(dt float32) {
	if on {
		for i := 0; i < 10; i++ {
			bots = append(bots, &Sprite{0, 0, rand.Float32() * 500, (rand.Float32() * 500) - 250, region})
		}
		num += 10
		counter.Set("innerHTML", num)
	}

	minX := float32(0)
	maxX := app.Width() - region.Width()
	minY := float32(0)
	maxY := app.Height() - region.Height()

	for _, bot := range bots {
		bot.X += bot.DX * dt
		bot.Y += bot.DY * dt
		bot.DY += 750 * dt

		if bot.X < minX {
			bot.DX *= -1
			bot.X = minX
		} else if bot.X > maxX {
			bot.DX *= -1
			bot.X = maxX
		}

		if bot.Y < minY {
			bot.DY = 0
			bot.Y = minY
		} else if bot.Y > maxY {
			bot.DY *= -.85
			bot.Y = maxY
			if rand.Float32() > 0.5 {
				bot.DY -= rand.Float32() * 200
			}
		}
	}
}

func (b *Botmark) Draw() {
	batch.Begin()
	for _, bot := range bots {
		batch.Draw(bot.Image, bot.X, bot.Y, 0, 0, 1, 1, 0)
	}
	batch.End()
	stats.Call("update")
}

func (b *Botmark) Mouse(x, y float32, action int) {
	switch action {
	case enj.MOUSEMOVE:
	case enj.MOUSEDOWN:
		on = true
	case enj.MOUSEUP:
		on = false
	}
}

func main() {
	app = enj.NewApp(800, 600, false, "example", new(Botmark))
}
