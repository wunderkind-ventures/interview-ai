"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Star } from "lucide-react";
import { motion } from "framer-motion";

const testimonials = [
  {
    name: "Sarah Chen",
    role: "Senior Software Engineer",
    company: "Google",
    image: "/avatars/sarah.jpg",
    initials: "SC",
    content: "InterviewAI helped me prepare for my Google interviews. The AI feedback was spot-on and helped me identify areas I needed to improve. Landed my dream job!",
    rating: 5,
  },
  {
    name: "Michael Rodriguez",
    role: "Product Manager",
    company: "Meta",
    image: "/avatars/michael.jpg",
    initials: "MR",
    content: "The product sense questions were exactly what I faced in my interviews. The practice sessions gave me confidence and helped me structure my answers better.",
    rating: 5,
  },
  {
    name: "Emily Zhang",
    role: "ML Engineer",
    company: "Amazon",
    image: "/avatars/emily.jpg",
    initials: "EZ",
    content: "The technical system design interviews were comprehensive. I loved how the AI adapted to my responses and pushed me to think deeper about scalability.",
    rating: 5,
  },
  {
    name: "David Kim",
    role: "Engineering Manager",
    company: "Apple",
    image: "/avatars/david.jpg",
    initials: "DK",
    content: "As someone transitioning to management, the behavioral interview practice was invaluable. The scenarios were realistic and feedback was actionable.",
    rating: 5,
  },
  {
    name: "Jessica Liu",
    role: "Staff Engineer",
    company: "Netflix",
    image: "/avatars/jessica.jpg",
    initials: "JL",
    content: "The FAANG-level questions really prepared me for the high bar. The progress tracking kept me motivated throughout my preparation journey.",
    rating: 5,
  },
  {
    name: "Alex Thompson",
    role: "Technical Lead",
    company: "Microsoft",
    image: "/avatars/alex.jpg",
    initials: "AT",
    content: "InterviewAI's resume analysis helped me highlight my achievements better. The mock interviews built my confidence for the real thing.",
    rating: 5,
  },
];

export default function Testimonials() {
  return (
    <section className="py-20 sm:py-32 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-2xl text-center mb-16">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
            className="text-3xl font-bold tracking-tight sm:text-4xl"
          >
            Trusted by{" "}
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Thousands
            </span>{" "}
            of Engineers
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            viewport={{ once: true }}
            className="mt-4 text-lg text-muted-foreground"
          >
            See how InterviewAI has helped professionals land jobs at top tech companies
          </motion.p>
        </div>

        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={testimonial.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              viewport={{ once: true }}
            >
              <Card className="h-full">
                <CardContent className="p-6">
                  {/* Rating stars */}
                  <div className="flex gap-1 mb-4">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="h-4 w-4 fill-primary text-primary" />
                    ))}
                  </div>

                  {/* Testimonial content */}
                  <p className="text-muted-foreground mb-6">"{testimonial.content}"</p>

                  {/* Author info */}
                  <div className="flex items-center gap-4">
                    <Avatar>
                      <AvatarImage src={testimonial.image} alt={testimonial.name} />
                      <AvatarFallback>{testimonial.initials}</AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-semibold">{testimonial.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {testimonial.role} at {testimonial.company}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Call to action */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
          className="mt-16 text-center"
        >
          <p className="text-lg text-muted-foreground mb-8">
            Join thousands of successful candidates who aced their interviews with InterviewAI
          </p>
        </motion.div>
      </div>
    </section>
  );
}