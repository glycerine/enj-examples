package main

import (
	"github.com/ajhager/enj"
	"math"
)

var (
	app     *enj.App
	time    float32
	regions []*enj.Region
	batch   *enj.Batch
	mx, my  float32
	down    float32
)

type Basics struct {
	*enj.Game
}

func (b *Basics) Load() {
	app.Load.Image("../data/bot.png")
}

func (b *Basics) Setup() {
	texture := app.NewTexture("../data/bot.png", false)
	texture.SetFilter(app.GL.NEAREST, app.GL.NEAREST)
	regions = texture.Split(32, 32)
	batch = app.NewBatch()
	down = 50
	app.SetBgColor(50, 80, 110, 255)
}

func (b *Basics) Update(dt float32) {
	time += dt * 200
}

func (b *Basics) Draw() {
	batch.Begin()
	batch.Draw(regions[0], mx-16, my-16, 16, 16, 2, 2, 0)
	batch.Draw(regions[4+int(math.Mod(float64(time), 6))], mx-16-down, my-16, down+16, 16, down/50, down/50, float32(time/2+90))
	batch.End()
}

func (b *Basics) Mouse(x, y float32, e int) {
	switch e {
	case enj.MOUSEMOVE:
		mx = x
		my = y
	case enj.MOUSEDOWN:
		down = 100
	case enj.MOUSEUP:
		down = 50
	}
}

func main() {
	app = enj.NewApp(800, 600, false, "example", new(Basics))
}
